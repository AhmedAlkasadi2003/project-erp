import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CostingEngineService } from './costing/costing-engine.service';
import { StockBalanceService } from './stock-balance.service';
import { QueryStockMovementsDto } from './dto/query-stock-movements.dto';

export interface RecordInboundParams {
  companyId: string;
  warehouseId: string;
  itemId: string;
  quantity: Prisma.Decimal | number | string;
  unitCost: Prisma.Decimal | number | string;
  movementType?: StockMovementType;
  referenceType: string;
  referenceId: string;
  receiptId?: string;
  receiptLineId?: string;
  userId: string;
  movementDate?: Date;
}

export interface RecordOutboundParams {
  companyId: string;
  warehouseId: string;
  itemId: string;
  quantity: Prisma.Decimal | number | string;
  movementType?: StockMovementType;
  referenceType: string;
  referenceId: string;
  userId: string;
  movementDate?: Date;
}

export interface ReverseMovementParams {
  companyId: string;
  movementId: string;
  userId: string;
  reason?: string;
}

@Injectable()
export class InventoryLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costingEngine: CostingEngineService,
    private readonly stockBalanceService: StockBalanceService,
  ) {}

  /**
   * Executes a transaction block with bounded retries for transient concurrency collisions.
   */
  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (err: unknown) {
        attempts++;
        if (this.isTransientConcurrencyError(err) && attempts < maxRetries) {
          const jitter = Math.floor(Math.random() * 30) + attempts * 40;
          await new Promise((resolve) => setTimeout(resolve, jitter));
          continue;
        }
        throw err;
      }
    }
    return operation();
  }

  private isTransientConcurrencyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { code?: string; message?: string };
    // Prisma transaction conflict or Postgres serialization / deadlock codes
    if (err.code === 'P2034' || err.code === '40001' || err.code === '40P01') {
      return true;
    }
    if (
      err.message &&
      (err.message.includes('deadlock') || err.message.includes('could not serialize'))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Record an inbound inventory movement and update the stock balance and moving average cost atomically.
   */
  async recordInboundMovement(params: RecordInboundParams, externalTx?: Prisma.TransactionClient) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Validate entity boundaries within authorized company
      const warehouse = await tx.warehouse.findFirst({
        where: { id: params.warehouseId, companyId: params.companyId, isActive: true },
      });
      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse '${params.warehouseId}' not found or inactive for this company`,
        );
      }

      const item = await tx.item.findFirst({
        where: { id: params.itemId, companyId: params.companyId, isActive: true },
      });
      if (!item) {
        throw new BadRequestException(
          `Item '${params.itemId}' not found or inactive for this company`,
        );
      }

      // 2. Lock balance row exclusively for update
      const balanceRow = await this.stockBalanceService.lockBalanceForUpdate(
        tx,
        params.companyId,
        params.warehouseId,
        params.itemId,
      );

      // 3. Compute new moving average cost and balance
      const costing = this.costingEngine.calculateInbound(
        balanceRow.quantityOnHand,
        balanceRow.totalValue,
        balanceRow.averageCost,
        params.quantity,
        params.unitCost,
      );

      // 4. Update stock balance snapshot
      const updatedBalance = await tx.stockBalance.update({
        where: { id: balanceRow.id },
        data: {
          quantityOnHand: costing.newQuantity,
          totalValue: costing.newTotalValue,
          averageCost: costing.newAverageCost,
          version: { increment: 1 },
        },
      });

      // 5. Append immutable stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          companyId: params.companyId,
          warehouseId: params.warehouseId,
          itemId: params.itemId,
          receiptId: params.receiptId || null,
          receiptLineId: params.receiptLineId || null,
          movementType: params.movementType || StockMovementType.RECEIPT,
          quantity: CostingEngineService.toDecimal(params.quantity),
          unitCost: CostingEngineService.toDecimal(params.unitCost),
          totalCost: costing.incomingValue,
          balanceAfter: costing.newQuantity,
          averageCostAfter: costing.newAverageCost,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          movementDate: params.movementDate || new Date(),
          performedByUserId: params.userId,
        },
      });

      return { movement, updatedBalance };
    };

    if (externalTx) {
      return execute(externalTx);
    }

    return this.withRetry(() => this.prisma.$transaction(execute));
  }

  /**
   * Record an outbound inventory movement, relieving inventory at the current moving average cost.
   */
  async recordOutboundMovement(
    params: RecordOutboundParams,
    externalTx?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Validate entity boundaries within authorized company
      const warehouse = await tx.warehouse.findFirst({
        where: { id: params.warehouseId, companyId: params.companyId, isActive: true },
      });
      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse '${params.warehouseId}' not found or inactive for this company`,
        );
      }

      const item = await tx.item.findFirst({
        where: { id: params.itemId, companyId: params.companyId, isActive: true },
      });
      if (!item) {
        throw new BadRequestException(
          `Item '${params.itemId}' not found or inactive for this company`,
        );
      }

      // 2. Lock balance row exclusively for update
      const balanceRow = await this.stockBalanceService.lockBalanceForUpdate(
        tx,
        params.companyId,
        params.warehouseId,
        params.itemId,
      );

      // 3. Compute outbound deduction and new balance (throws InsufficientStockException if requested > on-hand)
      const costing = this.costingEngine.calculateOutbound(
        balanceRow.quantityOnHand,
        balanceRow.totalValue,
        balanceRow.averageCost,
        params.quantity,
        params.itemId,
        params.warehouseId,
      );

      // 4. Update stock balance snapshot
      const updatedBalance = await tx.stockBalance.update({
        where: { id: balanceRow.id },
        data: {
          quantityOnHand: costing.newQuantity,
          totalValue: costing.newTotalValue,
          averageCost: costing.newAverageCost,
          version: { increment: 1 },
        },
      });

      // 5. Append immutable stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          companyId: params.companyId,
          warehouseId: params.warehouseId,
          itemId: params.itemId,
          movementType: params.movementType || StockMovementType.ISSUE,
          quantity: CostingEngineService.toDecimal(params.quantity),
          unitCost: costing.unitCost,
          totalCost: costing.deductedValue,
          balanceAfter: costing.newQuantity,
          averageCostAfter: costing.newAverageCost,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          movementDate: params.movementDate || new Date(),
          performedByUserId: params.userId,
        },
      });

      return { movement, updatedBalance };
    };

    if (externalTx) {
      return execute(externalTx);
    }

    return this.withRetry(() => this.prisma.$transaction(execute));
  }

  /**
   * Reverse an existing stock movement through an linked compensating movement.
   * Committed movements are never deleted or updated.
   */
  async reverseMovement(params: ReverseMovementParams, externalTx?: Prisma.TransactionClient) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Find original movement and verify company ownership
      const original = await tx.stockMovement.findUnique({
        where: { id: params.movementId },
      });

      if (!original) {
        throw new NotFoundException(`Stock movement with ID '${params.movementId}' was not found`);
      }

      if (original.companyId !== params.companyId) {
        throw new ForbiddenException(
          'Cross-company access denied: you cannot reverse movements belonging to another company',
        );
      }

      // 2. Prevent duplicate reversal
      const existingReversal = await tx.stockMovement.findFirst({
        where: {
          companyId: params.companyId,
          referenceType: 'STOCK_MOVEMENT_REVERSAL',
          referenceId: original.id,
        },
      });

      if (existingReversal) {
        throw new ConflictException(
          `Stock movement '${params.movementId}' has already been reversed by movement '${existingReversal.id}'`,
        );
      }

      // 3. Compensating movement logic
      const isInbound =
        original.movementType === StockMovementType.RECEIPT ||
        original.movementType === StockMovementType.ADJUSTMENT_IN;

      if (isInbound) {
        // Reversing an inbound movement requires deducting the quantity
        const balanceRow = await this.stockBalanceService.lockBalanceForUpdate(
          tx,
          original.companyId,
          original.warehouseId,
          original.itemId,
        );

        if (balanceRow.quantityOnHand.lessThan(original.quantity)) {
          throw new BadRequestException(
            `Cannot reverse inbound movement: current on-hand stock (${balanceRow.quantityOnHand.toString()}) is less than original quantity (${original.quantity.toString()})`,
          );
        }

        const costing = this.costingEngine.calculateOutbound(
          balanceRow.quantityOnHand,
          balanceRow.totalValue,
          balanceRow.averageCost,
          original.quantity,
          original.itemId,
          original.warehouseId,
        );

        const updatedBalance = await tx.stockBalance.update({
          where: { id: balanceRow.id },
          data: {
            quantityOnHand: costing.newQuantity,
            totalValue: costing.newTotalValue,
            averageCost: costing.newAverageCost,
            version: { increment: 1 },
          },
        });

        const reversalMovement = await tx.stockMovement.create({
          data: {
            companyId: original.companyId,
            warehouseId: original.warehouseId,
            itemId: original.itemId,
            receiptId: original.receiptId,
            receiptLineId: original.receiptLineId,
            movementType: StockMovementType.ADJUSTMENT_OUT,
            quantity: original.quantity,
            unitCost: costing.unitCost,
            totalCost: costing.deductedValue,
            balanceAfter: costing.newQuantity,
            averageCostAfter: costing.newAverageCost,
            referenceType: 'STOCK_MOVEMENT_REVERSAL',
            referenceId: original.id,
            movementDate: new Date(),
            performedByUserId: params.userId,
          },
        });

        return { reversalMovement, updatedBalance };
      } else {
        // Reversing an outbound movement returns the material at its original unit cost
        const balanceRow = await this.stockBalanceService.lockBalanceForUpdate(
          tx,
          original.companyId,
          original.warehouseId,
          original.itemId,
        );

        const costing = this.costingEngine.calculateInbound(
          balanceRow.quantityOnHand,
          balanceRow.totalValue,
          balanceRow.averageCost,
          original.quantity,
          original.unitCost,
        );

        const updatedBalance = await tx.stockBalance.update({
          where: { id: balanceRow.id },
          data: {
            quantityOnHand: costing.newQuantity,
            totalValue: costing.newTotalValue,
            averageCost: costing.newAverageCost,
            version: { increment: 1 },
          },
        });

        const reversalMovement = await tx.stockMovement.create({
          data: {
            companyId: original.companyId,
            warehouseId: original.warehouseId,
            itemId: original.itemId,
            receiptId: original.receiptId,
            receiptLineId: original.receiptLineId,
            movementType: StockMovementType.ADJUSTMENT_IN,
            quantity: original.quantity,
            unitCost: original.unitCost,
            totalCost: costing.incomingValue,
            balanceAfter: costing.newQuantity,
            averageCostAfter: costing.newAverageCost,
            referenceType: 'STOCK_MOVEMENT_REVERSAL',
            referenceId: original.id,
            movementDate: new Date(),
            performedByUserId: params.userId,
          },
        });

        return { reversalMovement, updatedBalance };
      }
    };

    if (externalTx) {
      return execute(externalTx);
    }

    return this.withRetry(() => this.prisma.$transaction(execute));
  }

  /**
   * Paginated list of stock movements (stock card inquiry) within authorized company.
   */
  async getMovements(companyId: string, query: QueryStockMovementsDto) {
    const where: Prisma.StockMovementWhereInput = { companyId };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.itemId) {
      where.itemId = query.itemId;
    }
    if (query.movementType) {
      where.movementType = query.movementType;
    }
    if (query.referenceType) {
      where.referenceType = query.referenceType;
    }
    if (query.referenceId) {
      where.referenceId = query.referenceId;
    }

    if (query.startDate || query.endDate) {
      where.movementDate = {};
      if (query.startDate) {
        where.movementDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.movementDate.lte = new Date(query.endDate);
      }
    }

    const totalItems = await this.prisma.stockMovement.count({ where });
    const page = query.page;
    const limit = query.limit;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const skip = (page - 1) * limit;

    const data = await this.prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true, uom: true } },
        performedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}

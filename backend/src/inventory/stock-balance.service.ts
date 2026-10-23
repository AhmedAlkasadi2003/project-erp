import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStockBalancesDto } from './dto/query-stock-balances.dto';
import {
  LockedStockBalance,
  StockBalanceRepository,
} from './repositories/stock-balance.repository';

export { LockedStockBalance };

export interface BalanceReconciliationReport {
  companyId: string;
  warehouseId: string;
  itemId: string;
  balanceOnHand: Prisma.Decimal;
  balanceTotalValue: Prisma.Decimal;
  balanceAverageCost: Prisma.Decimal;
  ledgerAggregatedQuantity: Prisma.Decimal;
  isReconciled: boolean;
  discrepancy: Prisma.Decimal;
  movementCount: number;
}

@Injectable()
export class StockBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: StockBalanceRepository,
  ) {}

  /**
   * Ensures an initial zero-balance row exists for the given company, warehouse, and item.
   * Delegates to StockBalanceRepository.
   */
  async ensureBalanceExists(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    itemId: string,
  ): Promise<void> {
    return this.repository.ensureBalanceExists(tx, companyId, warehouseId, itemId);
  }

  /**
   * Acquires an exclusive row-level lock (SELECT ... FOR UPDATE) on the stock balance row.
   * Delegates to StockBalanceRepository.
   */
  async lockBalanceForUpdate(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    itemId: string,
  ): Promise<LockedStockBalance> {
    return this.repository.lockBalanceForUpdate(tx, companyId, warehouseId, itemId);
  }

  /**
   * Read-only retrieval of current stock balance for a specific item in a warehouse.
   */
  async getBalance(companyId: string, warehouseId: string, itemId: string) {
    const balance = await this.prisma.stockBalance.findUnique({
      where: {
        companyId_warehouseId_itemId: {
          companyId,
          warehouseId,
          itemId,
        },
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true, uom: true, valuationMethod: true },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    if (!balance) {
      throw new NotFoundException(
        `Stock balance not found for item '${itemId}' in warehouse '${warehouseId}'`,
      );
    }

    return balance;
  }

  /**
   * Paginated list of stock balances within the authorized company.
   */
  async listBalances(companyId: string, query: QueryStockBalancesDto) {
    const where: Prisma.StockBalanceWhereInput = { companyId };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.itemId) {
      where.itemId = query.itemId;
    }

    const totalItems = await this.prisma.stockBalance.count({ where });
    const page = query.page;
    const limit = query.limit;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const skip = (page - 1) * limit;

    const data = await this.prisma.stockBalance.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      include: {
        item: {
          select: { id: true, sku: true, name: true, uom: true, valuationMethod: true },
        },
        warehouse: { select: { id: true, code: true, name: true } },
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

  /**
   * Read-only reconciliation check verifying that the current StockBalance
   * exactly equals the aggregate of all historical StockMovement records.
   */
  async reconcileBalance(
    companyId: string,
    warehouseId: string,
    itemId: string,
  ): Promise<BalanceReconciliationReport> {
    const balance = await this.prisma.stockBalance.findUnique({
      where: {
        companyId_warehouseId_itemId: {
          companyId,
          warehouseId,
          itemId,
        },
      },
    });

    const onHand = balance ? new Prisma.Decimal(balance.quantityOnHand) : new Prisma.Decimal(0);
    const totalVal = balance ? new Prisma.Decimal(balance.totalValue) : new Prisma.Decimal(0);
    const avgCost = balance ? new Prisma.Decimal(balance.averageCost) : new Prisma.Decimal(0);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId,
        warehouseId,
        itemId,
      },
      select: {
        movementType: true,
        quantity: true,
      },
    });

    let ledgerAggregated = new Prisma.Decimal(0);
    for (const m of movements) {
      const qty = new Prisma.Decimal(m.quantity);
      if (m.movementType === 'RECEIPT' || m.movementType === 'ADJUSTMENT_IN') {
        ledgerAggregated = ledgerAggregated.add(qty);
      } else {
        ledgerAggregated = ledgerAggregated.sub(qty);
      }
    }

    ledgerAggregated = ledgerAggregated.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const discrepancy = onHand.sub(ledgerAggregated);
    const isReconciled = discrepancy.isZero();

    return {
      companyId,
      warehouseId,
      itemId,
      balanceOnHand: onHand,
      balanceTotalValue: totalVal,
      balanceAverageCost: avgCost,
      ledgerAggregatedQuantity: ledgerAggregated,
      isReconciled,
      discrepancy,
      movementCount: movements.length,
    };
  }
}

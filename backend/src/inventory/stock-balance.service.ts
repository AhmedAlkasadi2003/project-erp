import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStockBalancesDto } from './dto/query-stock-balances.dto';

export interface LockedStockBalance {
  id: string;
  companyId: string;
  warehouseId: string;
  itemId: string;
  quantityOnHand: Prisma.Decimal;
  totalValue: Prisma.Decimal;
  averageCost: Prisma.Decimal;
  version: number;
  updatedAt: Date;
}

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures an initial zero-balance row exists for the given company, warehouse, and item.
   * Uses PostgreSQL ON CONFLICT DO NOTHING to eliminate race conditions without errors.
   */
  async ensureBalanceExists(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    itemId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO stock_balances ("id", "companyId", "warehouseId", "itemId", "quantityOnHand", "totalValue", "averageCost", "version", "updatedAt")
      VALUES (gen_random_uuid(), ${companyId}, ${warehouseId}, ${itemId}, 0, 0, 0, 1, NOW())
      ON CONFLICT ("companyId", "warehouseId", "itemId") DO NOTHING;
    `;
  }

  /**
   * Acquires an exclusive row-level lock (SELECT ... FOR UPDATE) on the stock balance row.
   * Guarantees the row exists by running ensureBalanceExists first.
   */
  async lockBalanceForUpdate(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    itemId: string,
  ): Promise<LockedStockBalance> {
    await this.ensureBalanceExists(tx, companyId, warehouseId, itemId);

    const rows = await tx.$queryRaw<LockedStockBalance[]>`
      SELECT id, "companyId", "warehouseId", "itemId", "quantityOnHand", "totalValue", "averageCost", "version", "updatedAt"
      FROM stock_balances
      WHERE "companyId" = ${companyId} AND "warehouseId" = ${warehouseId} AND "itemId" = ${itemId}
      FOR UPDATE;
    `;

    if (!rows || rows.length === 0) {
      throw new NotFoundException(
        `Failed to acquire lock for balance row: item '${itemId}' in warehouse '${warehouseId}'`,
      );
    }

    const row = rows[0];
    return {
      ...row,
      quantityOnHand: new Prisma.Decimal(row.quantityOnHand),
      totalValue: new Prisma.Decimal(row.totalValue),
      averageCost: new Prisma.Decimal(row.averageCost),
    };
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

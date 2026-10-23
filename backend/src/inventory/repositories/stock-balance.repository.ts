import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

@Injectable()
export class StockBalanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures an initial zero-balance row exists for the given company, warehouse, and item.
   * Uses PostgreSQL atomic INSERT ... ON CONFLICT DO NOTHING to eliminate race conditions.
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
}

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { StockBalanceService } from './stock-balance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StockBalanceService (Unit)', () => {
  let service: StockBalanceService;
  let mockPrisma: {
    stockBalance: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    stockMovement: {
      findMany: jest.Mock;
    };
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
  };

  const companyId = 'company-1';
  const warehouseId = 'warehouse-1';
  const itemId = 'item-1';

  beforeEach(async () => {
    mockPrisma = {
      stockBalance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
      },
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockBalanceService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<StockBalanceService>(StockBalanceService);
  });

  describe('ensureBalanceExists() & lockBalanceForUpdate()', () => {
    it('should upsert zero balance and lock row with SELECT FOR UPDATE', async () => {
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: 'balance-uuid-1',
            companyId,
            warehouseId,
            itemId,
            quantityOnHand: '10.0000',
            totalValue: '150.0000',
            averageCost: '15.0000',
            version: 1,
            updatedAt: new Date(),
          },
        ]),
      } as unknown as Prisma.TransactionClient;

      const locked = await service.lockBalanceForUpdate(mockTx, companyId, warehouseId, itemId);

      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(locked.id).toBe('balance-uuid-1');
      expect(locked.quantityOnHand.toFixed(4)).toBe('10.0000');
      expect(locked.totalValue.toFixed(4)).toBe('150.0000');
      expect(locked.averageCost.toFixed(4)).toBe('15.0000');
    });
  });

  describe('getBalance()', () => {
    it('should return balance details if found', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValue({
        id: 'balance-1',
        companyId,
        warehouseId,
        itemId,
        quantityOnHand: new Prisma.Decimal(10),
      });

      const res = await service.getBalance(companyId, warehouseId, itemId);
      expect(res.id).toBe('balance-1');
    });

    it('should throw NotFoundException if balance is missing', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValue(null);

      await expect(service.getBalance(companyId, warehouseId, itemId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reconcileBalance()', () => {
    it('should accurately compare on-hand balance against movement ledger sum', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal('25.0000'),
        totalValue: new Prisma.Decimal('250.0000'),
        averageCost: new Prisma.Decimal('10.0000'),
      });

      mockPrisma.stockMovement.findMany.mockResolvedValue([
        { movementType: 'RECEIPT', quantity: '20.0000' },
        { movementType: 'RECEIPT', quantity: '10.0000' },
        { movementType: 'ISSUE', quantity: '5.0000' },
      ]);

      const report = await service.reconcileBalance(companyId, warehouseId, itemId);

      // 20 + 10 - 5 = 25.0000
      expect(report.isReconciled).toBe(true);
      expect(report.balanceOnHand.toFixed(4)).toBe('25.0000');
      expect(report.ledgerAggregatedQuantity.toFixed(4)).toBe('25.0000');
      expect(report.discrepancy.toFixed(4)).toBe('0.0000');
      expect(report.movementCount).toBe(3);
    });

    it('should report discrepancy when on-hand balance does not match movements', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal('30.0000'), // Discrepancy!
        totalValue: new Prisma.Decimal('300.0000'),
        averageCost: new Prisma.Decimal('10.0000'),
      });

      mockPrisma.stockMovement.findMany.mockResolvedValue([
        { movementType: 'RECEIPT', quantity: '20.0000' },
      ]);

      const report = await service.reconcileBalance(companyId, warehouseId, itemId);

      expect(report.isReconciled).toBe(false);
      expect(report.discrepancy.toFixed(4)).toBe('10.0000');
    });
  });
});

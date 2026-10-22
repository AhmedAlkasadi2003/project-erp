import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StockMovementType } from '@prisma/client';
import { InventoryLedgerService } from './inventory-ledger.service';
import { CostingEngineService } from './costing/costing-engine.service';
import { StockBalanceService } from './stock-balance.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStockCardDto } from './dto/query-stock-card.dto';

describe('InventoryLedgerService (Unit)', () => {
  let service: InventoryLedgerService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  let mockCostingEngine: {
    calculateInbound: jest.Mock;
    calculateOutbound: jest.Mock;
  };
  let mockStockBalanceService: {
    lockBalanceForUpdate: jest.Mock;
  };

  const companyId = 'company-1';
  const warehouseId = 'warehouse-1';
  const itemId = 'item-1';
  const userId = 'user-1';

  beforeEach(async () => {
    mockPrisma = {
      warehouse: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      stockBalance: { update: jest.fn(), findMany: jest.fn() },
      stockMovement: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockCostingEngine = {
      calculateInbound: jest.fn(),
      calculateOutbound: jest.fn(),
    };

    mockStockBalanceService = {
      lockBalanceForUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryLedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CostingEngineService, useValue: mockCostingEngine },
        { provide: StockBalanceService, useValue: mockStockBalanceService },
      ],
    }).compile();

    service = module.get<InventoryLedgerService>(InventoryLedgerService);
  });

  describe('recordInboundMovement()', () => {
    it('should lock balance, compute costing, update balance and append movement', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: warehouseId,
        companyId,
        isActive: true,
      });
      mockPrisma.item.findFirst.mockResolvedValue({ id: itemId, companyId, isActive: true });

      mockStockBalanceService.lockBalanceForUpdate.mockResolvedValue({
        id: 'balance-1',
        quantityOnHand: new Prisma.Decimal(10),
        totalValue: new Prisma.Decimal(150),
        averageCost: new Prisma.Decimal(15),
      });

      mockCostingEngine.calculateInbound.mockReturnValue({
        newQuantity: new Prisma.Decimal(20),
        incomingValue: new Prisma.Decimal(250),
        newTotalValue: new Prisma.Decimal(400),
        newAverageCost: new Prisma.Decimal(20),
      });

      mockPrisma.stockBalance.update.mockResolvedValue({
        id: 'balance-1',
        quantityOnHand: new Prisma.Decimal(20),
        totalValue: new Prisma.Decimal(400),
        averageCost: new Prisma.Decimal(20),
      });

      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 'movement-1',
        movementType: StockMovementType.RECEIPT,
        quantity: new Prisma.Decimal(10),
        unitCost: new Prisma.Decimal(25),
      });

      const res = await service.recordInboundMovement({
        companyId,
        warehouseId,
        itemId,
        quantity: 10,
        unitCost: 25,
        referenceType: 'RECEIPT',
        referenceId: 'rec-1',
        userId,
      });

      expect(mockStockBalanceService.lockBalanceForUpdate).toHaveBeenCalledWith(
        mockPrisma,
        companyId,
        warehouseId,
        itemId,
      );
      expect(mockCostingEngine.calculateInbound).toHaveBeenCalled();
      expect(mockPrisma.stockBalance.update).toHaveBeenCalled();
      expect(mockPrisma.stockMovement.create).toHaveBeenCalled();
      expect(res.movement.id).toBe('movement-1');
    });

    it('should reject if warehouse is not found or inactive for company', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.recordInboundMovement({
          companyId,
          warehouseId: 'invalid-wh',
          itemId,
          quantity: 10,
          unitCost: 20,
          referenceType: 'RECEIPT',
          referenceId: 'rec-1',
          userId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordOutboundMovement()', () => {
    it('should relieve inventory at average cost and update balance', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: warehouseId,
        companyId,
        isActive: true,
      });
      mockPrisma.item.findFirst.mockResolvedValue({ id: itemId, companyId, isActive: true });

      mockStockBalanceService.lockBalanceForUpdate.mockResolvedValue({
        id: 'balance-1',
        quantityOnHand: new Prisma.Decimal(20),
        totalValue: new Prisma.Decimal(400),
        averageCost: new Prisma.Decimal(20),
      });

      mockCostingEngine.calculateOutbound.mockReturnValue({
        newQuantity: new Prisma.Decimal(15),
        unitCost: new Prisma.Decimal(20),
        deductedValue: new Prisma.Decimal(100),
        newTotalValue: new Prisma.Decimal(300),
        newAverageCost: new Prisma.Decimal(20),
      });

      mockPrisma.stockBalance.update.mockResolvedValue({
        id: 'balance-1',
        quantityOnHand: new Prisma.Decimal(15),
      });

      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 'movement-issue-1',
        movementType: StockMovementType.ISSUE,
      });

      const res = await service.recordOutboundMovement({
        companyId,
        warehouseId,
        itemId,
        quantity: 5,
        referenceType: 'INTERNAL_ISSUE',
        referenceId: 'issue-100',
        userId,
      });

      expect(mockCostingEngine.calculateOutbound).toHaveBeenCalled();
      expect(res.movement.id).toBe('movement-issue-1');
    });
  });

  describe('reverseMovement()', () => {
    it('should reject duplicate reversal of the same stock movement', async () => {
      mockPrisma.stockMovement.findUnique.mockResolvedValue({
        id: 'mov-1',
        companyId,
        movementType: StockMovementType.RECEIPT,
      });

      mockPrisma.stockMovement.findFirst.mockResolvedValue({
        id: 'existing-reversal-mov',
      });

      await expect(
        service.reverseMovement({
          companyId,
          movementId: 'mov-1',
          userId,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject cross-company movement reversal', async () => {
      mockPrisma.stockMovement.findUnique.mockResolvedValue({
        id: 'mov-cross',
        companyId: 'other-company',
      });

      await expect(
        service.reverseMovement({
          companyId,
          movementId: 'mov-cross',
          userId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('withRetry()', () => {
    it('should retry transient concurrency collisions and succeed', async () => {
      let callCount = 0;
      const op = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('deadlock detected') as Error & { code: string };
          err.code = '40P01';
          throw err;
        }
        return 'success';
      });

      const res = await service.withRetry(op, 3);
      expect(res).toBe('success');
      expect(callCount).toBe(2);
    });

    it('should NOT retry business validation errors', async () => {
      const op = jest.fn().mockRejectedValue(new BadRequestException('Invalid data'));

      await expect(service.withRetry(op, 3)).rejects.toThrow(BadRequestException);
      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStockCard()', () => {
    it('should throw NotFoundException if item does not exist in company', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.getStockCard(companyId, 'non-existent-item', new QueryStockCardDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if warehouse does not exist in company', async () => {
      mockPrisma.item.findFirst.mockResolvedValue({
        id: itemId,
        sku: 'SKU-01',
        name: 'Steel Sheet',
        uom: 'PCS',
        valuationMethod: 'MOVING_AVERAGE',
      });
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);

      const query: QueryStockCardDto = {
        warehouseId: 'bad-warehouse',
        page: 1,
        limit: 50,
      };

      await expect(service.getStockCard(companyId, itemId, query)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if from date is after to date', async () => {
      mockPrisma.item.findFirst.mockResolvedValue({
        id: itemId,
        sku: 'SKU-01',
        name: 'Steel Sheet',
        uom: 'PCS',
        valuationMethod: 'MOVING_AVERAGE',
      });

      const query: QueryStockCardDto = {
        from: '2026-06-01',
        to: '2026-01-01',
        page: 1,
        limit: 50,
      };

      await expect(service.getStockCard(companyId, itemId, query)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return complete stock card with opening balance, movements, running balances, and closing balance', async () => {
      mockPrisma.item.findFirst.mockResolvedValue({
        id: itemId,
        sku: 'SKU-01',
        name: 'Steel Sheet',
        uom: 'PCS',
        valuationMethod: 'MOVING_AVERAGE',
      });

      // Prior movement before `from` date: gives opening balance of 10 @ $15 = $150
      mockPrisma.stockMovement.findFirst
        .mockResolvedValueOnce({
          id: 'prior-1',
          balanceAfter: new Prisma.Decimal('10.0000'),
          averageCostAfter: new Prisma.Decimal('15.0000'),
        })
        // Second call inside getStockCard for closing balance
        .mockResolvedValueOnce({
          id: 'mov-1',
          balanceAfter: new Prisma.Decimal('20.0000'),
          averageCostAfter: new Prisma.Decimal('17.5000'),
        });

      mockPrisma.stockMovement.count.mockResolvedValue(1);
      mockPrisma.stockMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          movementDate: new Date('2026-01-15T10:00:00Z'),
          createdAt: new Date('2026-01-15T10:00:00Z'),
          movementType: StockMovementType.RECEIPT,
          referenceType: 'RECEIPT',
          referenceId: 'REC-001',
          receiptId: 'receipt-1',
          receiptLineId: 'line-1',
          warehouse: { id: warehouseId, code: 'WH-01', name: 'Main Warehouse' },
          quantity: new Prisma.Decimal('10.0000'),
          unitCost: new Prisma.Decimal('20.0000'),
          totalCost: new Prisma.Decimal('200.0000'),
          balanceAfter: new Prisma.Decimal('20.0000'),
          averageCostAfter: new Prisma.Decimal('17.5000'),
          performedByUser: { id: userId, name: 'Alice', email: 'alice@erp.local' },
        },
      ]);

      mockPrisma.stockBalance.findMany.mockResolvedValue([
        {
          warehouse: { id: warehouseId, code: 'WH-01', name: 'Main Warehouse' },
          quantityOnHand: new Prisma.Decimal('20.0000'),
          totalValue: new Prisma.Decimal('350.0000'),
          averageCost: new Prisma.Decimal('17.5000'),
        },
      ]);

      const query: QueryStockCardDto = {
        from: '2026-01-01',
        to: '2026-01-31',
        page: 1,
        limit: 50,
      };

      const result = await service.getStockCard(companyId, itemId, query);

      expect(result.item.sku).toBe('SKU-01');
      expect(result.openingBalance.quantity).toBe('10.0000');
      expect(result.openingBalance.averageCost).toBe('15.0000');
      expect(result.openingBalance.totalValue).toBe('150.0000');
      expect(result.closingBalance.quantity).toBe('20.0000');
      expect(result.closingBalance.averageCost).toBe('17.5000');
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].runningQuantity).toBe('20.0000');
      expect(result.movements[0].runningAverageCost).toBe('17.5000');
      expect(result.currentBalances[0].quantityOnHand).toBe('20.0000');
    });
  });
});

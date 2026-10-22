import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StockMovementType } from '@prisma/client';
import { InventoryLedgerService } from './inventory-ledger.service';
import { CostingEngineService } from './costing/costing-engine.service';
import { StockBalanceService } from './stock-balance.service';
import { PrismaService } from '../prisma/prisma.service';

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
      stockBalance: { update: jest.fn() },
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
});

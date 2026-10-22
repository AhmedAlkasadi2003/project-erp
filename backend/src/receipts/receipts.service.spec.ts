import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, ReceiptStatus, UserRole } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReceiptsService (Unit)', () => {
  let service: ReceiptsService;
  let mockPrisma: {
    warehouse: { findFirst: jest.Mock };
    supplier: { findFirst: jest.Mock };
    item: { findMany: jest.Mock; findFirst: jest.Mock };
    receipt: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    receiptLine: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const companyId = 'company-uuid-1';
  const otherCompanyId = 'company-uuid-2';
  const userId = 'user-uuid-1';
  const warehouseId = 'warehouse-uuid-1';
  const supplierId = 'supplier-uuid-1';
  const itemId1 = 'item-uuid-1';
  const itemId2 = 'item-uuid-2';

  beforeEach(async () => {
    mockPrisma = {
      warehouse: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
      item: { findMany: jest.fn(), findFirst: jest.fn() },
      receipt: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      receiptLine: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
  });

  describe('createReceipt()', () => {
    it('should successfully create a draft receipt with calculated totals', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: warehouseId,
        companyId,
        isActive: true,
      });
      mockPrisma.supplier.findFirst.mockResolvedValue({
        id: supplierId,
        companyId,
        isActive: true,
      });
      mockPrisma.item.findMany.mockResolvedValue([
        { id: itemId1, companyId, isActive: true },
        { id: itemId2, companyId, isActive: true },
      ]);
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockPrisma.receipt.create.mockImplementation(({ data }) => ({
        id: 'receipt-uuid-new',
        ...data,
      }));

      const result = await service.createReceipt(companyId, userId, {
        warehouseId,
        supplierId,
        receiptNumber: 'REC-CUSTOM-001',
        lines: [
          { itemId: itemId1, quantityReceived: 10, unitCost: 15.5, taxAmount: 0 },
          { itemId: itemId2, quantityReceived: '5.5', unitCost: '20.0', taxAmount: '2.5' },
        ],
      });

      expect(mockPrisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: { id: warehouseId, companyId, isActive: true },
      });
      expect(mockPrisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: supplierId, companyId, isActive: true },
      });
      expect(mockPrisma.receipt.create).toHaveBeenCalled();
      expect(result.receiptNumber).toBe('REC-CUSTOM-001');
      expect(result.status).toBe(ReceiptStatus.DRAFT);
      // line 1: 10 * 15.5 = 155, tax 0, total 155
      // line 2: 5.5 * 20.0 = 110, tax 2.5, total 112.5
      // receipt: subtotal 265, tax 2.5, total 267.5
      expect(result.subtotal.toString()).toBe('265');
      expect(result.taxAmount.toString()).toBe('2.5');
      expect(result.totalAmount.toString()).toBe('267.5');
    });

    it('should reject creation if warehouse is invalid or inactive for company', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.createReceipt(companyId, userId, {
          warehouseId: 'invalid-wh',
          supplierId,
          lines: [{ itemId: itemId1, quantityReceived: 1, unitCost: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if supplier is invalid or inactive for company', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: warehouseId,
        companyId,
        isActive: true,
      });
      mockPrisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.createReceipt(companyId, userId, {
          warehouseId,
          supplierId: 'invalid-sup',
          lines: [{ itemId: itemId1, quantityReceived: 1, unitCost: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if any item does not belong to the company', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: warehouseId,
        companyId,
        isActive: true,
      });
      mockPrisma.supplier.findFirst.mockResolvedValue({
        id: supplierId,
        companyId,
        isActive: true,
      });
      // Only returns 1 of the 2 requested items
      mockPrisma.item.findMany.mockResolvedValue([{ id: itemId1, companyId, isActive: true }]);

      await expect(
        service.createReceipt(companyId, userId, {
          warehouseId,
          supplierId,
          lines: [
            { itemId: itemId1, quantityReceived: 1, unitCost: 10 },
            { itemId: 'cross-company-item', quantityReceived: 1, unitCost: 10 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate receipt number in the same company', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: warehouseId,
        companyId,
        isActive: true,
      });
      mockPrisma.supplier.findFirst.mockResolvedValue({
        id: supplierId,
        companyId,
        isActive: true,
      });
      mockPrisma.item.findMany.mockResolvedValue([{ id: itemId1, companyId, isActive: true }]);
      mockPrisma.receipt.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.createReceipt(companyId, userId, {
          warehouseId,
          supplierId,
          receiptNumber: 'DUPLICATE-001',
          lines: [{ itemId: itemId1, quantityReceived: 1, unitCost: 10 }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getReceiptById()', () => {
    it('should return receipt details for matching company', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-1',
        companyId,
        receiptNumber: 'REC-001',
        status: ReceiptStatus.DRAFT,
      });

      const receipt = await service.getReceiptById(companyId, UserRole.ADMIN, 'rec-1');
      expect(receipt.id).toBe('rec-1');
    });

    it('should throw NotFoundException if receipt does not exist', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);

      await expect(
        service.getReceiptById(companyId, UserRole.ADMIN, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for cross-company access attempt', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-other',
        companyId: otherCompanyId,
      });

      await expect(service.getReceiptById(companyId, UserRole.CLERK, 'rec-other')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow SUPER_ADMIN to access cross-company receipt', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-other',
        companyId: otherCompanyId,
      });

      const result = await service.getReceiptById(companyId, UserRole.SUPER_ADMIN, 'rec-other');
      expect(result.id).toBe('rec-other');
    });
  });

  describe('updateReceipt()', () => {
    it('should reject updates if receipt is in POSTED status', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-posted',
        companyId,
        status: ReceiptStatus.POSTED,
      });

      await expect(
        service.updateReceipt(companyId, UserRole.ADMIN, 'rec-posted', {
          notes: 'Attempting modification',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update draft receipt header fields successfully', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-draft',
        companyId,
        status: ReceiptStatus.DRAFT,
        warehouseId,
        supplierId,
      });
      mockPrisma.receipt.update.mockResolvedValue({
        id: 'rec-draft',
        notes: 'Updated notes',
      });

      const res = await service.updateReceipt(companyId, UserRole.ADMIN, 'rec-draft', {
        notes: 'Updated notes',
      });
      expect(res.notes).toBe('Updated notes');
    });
  });

  describe('deleteReceipt()', () => {
    it('should reject deleting a POSTED receipt with ConflictException', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-posted',
        companyId,
        receiptNumber: 'REC-POSTED-001',
        status: ReceiptStatus.POSTED,
      });

      await expect(service.deleteReceipt(companyId, UserRole.ADMIN, 'rec-posted')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should delete a DRAFT receipt cleanly', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-draft',
        companyId,
        receiptNumber: 'REC-DRAFT-001',
        status: ReceiptStatus.DRAFT,
      });
      mockPrisma.receipt.delete.mockResolvedValue({});

      const res = await service.deleteReceipt(companyId, UserRole.ADMIN, 'rec-draft');
      expect(res.success).toBe(true);
      expect(mockPrisma.receipt.delete).toHaveBeenCalledWith({ where: { id: 'rec-draft' } });
    });
  });

  describe('removeLine()', () => {
    it('should reject deleting the only remaining line on a receipt', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-draft',
        companyId,
        status: ReceiptStatus.DRAFT,
      });
      mockPrisma.receiptLine.findMany.mockResolvedValue([{ id: 'single-line-id', lineNumber: 1 }]);

      await expect(
        service.removeLine(companyId, UserRole.ADMIN, 'rec-draft', 'single-line-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove a line and re-index remaining lines', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue({
        id: 'rec-draft',
        companyId,
        status: ReceiptStatus.DRAFT,
      });
      mockPrisma.receiptLine.findMany
        .mockResolvedValueOnce([
          { id: 'line-1', lineNumber: 1 },
          { id: 'line-2', lineNumber: 2 },
        ])
        .mockResolvedValueOnce([
          {
            id: 'line-2',
            lineNumber: 2,
            subtotal: new Prisma.Decimal(50),
            taxAmount: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(50),
          },
        ]);
      mockPrisma.receiptLine.delete.mockResolvedValue({});
      mockPrisma.receiptLine.update.mockResolvedValue({});
      mockPrisma.receipt.update.mockResolvedValue({ id: 'rec-draft' });

      await service.removeLine(companyId, UserRole.ADMIN, 'rec-draft', 'line-1');
      expect(mockPrisma.receiptLine.delete).toHaveBeenCalledWith({ where: { id: 'line-1' } });
      expect(mockPrisma.receiptLine.update).toHaveBeenCalledWith({
        where: { id: 'line-2' },
        data: { lineNumber: 1 },
      });
    });
  });
});

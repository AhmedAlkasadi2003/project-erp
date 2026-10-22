/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyStatus, JournalEntryStatus, Prisma, ReceiptStatus } from '@prisma/client';
import { ReceiptPostingService } from './receipt-posting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { StockBalanceService } from '../../inventory/stock-balance.service';
import { InventoryAccountsService } from '../../accounting/inventory-accounts/inventory-accounts.service';
import { AccountingPeriodsService } from '../../accounting/periods/accounting-periods.service';
import { JournalValidatorService } from '../../accounting/journal/journal-validator.service';
import { JournalEntriesService } from '../../accounting/journal/journal-entries.service';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../../outbox/outbox.service';

describe('ReceiptPostingService', () => {
  let service: ReceiptPostingService;
  let mockPrisma: any;
  let mockInventoryLedger: any;
  let mockStockBalanceService: any;
  let mockInventoryAccounts: any;
  let mockPeriodsService: any;
  let mockJournalValidator: any;
  let mockJournalEntriesService: any;
  let mockAuditService: any;
  let mockOutboxService: any;

  const companyId = 'company-123';
  const userId = 'user-123';
  const receiptId = 'receipt-123';

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn(async (callback) => {
        return callback(mockPrisma);
      }),
      $queryRaw: jest.fn(),
      receiptLine: {
        findMany: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      receipt: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      stockMovement: {
        findFirst: jest.fn(),
      },
      auditEvent: {
        create: jest.fn(),
      },
      idempotencyRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockInventoryLedger = {
      recordInboundMovement: jest.fn(),
      reverseMovement: jest.fn(),
    };

    mockStockBalanceService = {
      lockBalanceForUpdate: jest.fn(),
    };

    mockInventoryAccounts = {
      resolveReceiptAccounts: jest.fn(),
    };

    mockPeriodsService = {
      getEligibleOpenPeriod: jest.fn(),
    };

    mockJournalValidator = {
      validate: jest.fn(),
    };

    mockJournalEntriesService = {
      generateEntryNumber: jest.fn().mockResolvedValue('JE-2026-00001'),
    };

    mockAuditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockOutboxService = {
      createEvent: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptPostingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryLedgerService, useValue: mockInventoryLedger },
        { provide: StockBalanceService, useValue: mockStockBalanceService },
        { provide: InventoryAccountsService, useValue: mockInventoryAccounts },
        { provide: AccountingPeriodsService, useValue: mockPeriodsService },
        { provide: JournalValidatorService, useValue: mockJournalValidator },
        { provide: JournalEntriesService, useValue: mockJournalEntriesService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: OutboxService, useValue: mockOutboxService },
      ],
    }).compile();

    service = module.get<ReceiptPostingService>(ReceiptPostingService);
  });

  describe('postReceipt', () => {
    const mockReceiptRow = {
      id: receiptId,
      companyId,
      warehouseId: 'wh-1',
      supplierId: 'supp-1',
      receiptNumber: 'REC-2026-001',
      status: ReceiptStatus.DRAFT,
      receiptDate: new Date('2026-03-15'),
      postingDate: null,
      journalEntryId: null,
      subtotal: new Prisma.Decimal('100.0000'),
      taxAmount: new Prisma.Decimal('0.0000'),
      totalAmount: new Prisma.Decimal('100.0000'),
      version: 1,
    };

    const mockLines = [
      {
        id: 'line-1',
        receiptId,
        itemId: 'item-1',
        lineNumber: 1,
        quantityReceived: new Prisma.Decimal('10.0000'),
        unitCost: new Prisma.Decimal('10.0000'),
        subtotal: new Prisma.Decimal('100.0000'),
        taxAmount: new Prisma.Decimal('0.0000'),
        totalAmount: new Prisma.Decimal('100.0000'),
      },
    ];

    it('should successfully post a valid draft receipt atomically', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([mockReceiptRow]);
      mockPrisma.receiptLine.findMany.mockResolvedValue(mockLines);
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isActive: true });
      mockPrisma.supplier.findFirst.mockResolvedValue({ id: 'supp-1', isActive: true });

      mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({
        id: 'period-1',
        name: 'FY2026-03',
      });

      const mockAssetAccount = { id: 'acc-asset', code: '1200', name: 'Inventory Asset' };
      const mockClearingAccount = { id: 'acc-clearing', code: '2100', name: 'GRN Clearing' };
      const itemMap = new Map();
      itemMap.set('item-1', mockAssetAccount);

      mockInventoryAccounts.resolveReceiptAccounts.mockResolvedValue({
        grnClearingAccount: mockClearingAccount,
        itemAssetAccounts: itemMap,
      });

      mockInventoryLedger.recordInboundMovement.mockResolvedValue({
        movement: { id: 'm-1', quantity: new Prisma.Decimal('10.0000') },
      });

      mockJournalValidator.validate.mockResolvedValue({
        isValid: true,
        period: { id: 'period-1', name: 'FY2026-03' },
        totalDebit: new Prisma.Decimal('100.0000'),
        totalCredit: new Prisma.Decimal('100.0000'),
        lines: [
          {
            accountId: 'acc-asset',
            lineNumber: 1,
            debit: new Prisma.Decimal('100.0000'),
            credit: new Prisma.Decimal('0.0000'),
            description: 'Asset debit',
          },
          {
            accountId: 'acc-clearing',
            lineNumber: 2,
            debit: new Prisma.Decimal('0.0000'),
            credit: new Prisma.Decimal('100.0000'),
            description: 'Clearing credit',
          },
        ],
      });

      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        entryNumber: 'JE-2026-00001',
      });

      mockPrisma.receipt.update.mockResolvedValue({
        ...mockReceiptRow,
        status: ReceiptStatus.POSTED,
        journalEntryId: 'je-1',
      });

      const result = await service.postReceipt(companyId, userId, receiptId);

      expect(result).toBeDefined();
      expect(result.receipt.status).toBe(ReceiptStatus.POSTED);
      expect(result.journalEntryId).toBe('je-1');
      expect(mockInventoryLedger.recordInboundMovement).toHaveBeenCalledTimes(1);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'RECEIPT_POSTED',
          entityType: 'Receipt',
          entityId: receiptId,
        }),
      );
      expect(mockOutboxService.createEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'RECEIPT_POSTED',
          aggregateType: 'Receipt',
          aggregateId: receiptId,
        }),
      );
    });

    it('should throw NotFoundException if receipt does not exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await expect(service.postReceipt(companyId, userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if receipt is already POSTED', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ ...mockReceiptRow, status: ReceiptStatus.POSTED }]);

      await expect(service.postReceipt(companyId, userId, receiptId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if receipt has no line items', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([mockReceiptRow]);
      mockPrisma.receiptLine.findMany.mockResolvedValue([]);

      await expect(service.postReceipt(companyId, userId, receiptId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return cached response if idempotency record was previously COMPLETED', async () => {
      const cachedResponse = { message: 'Cached response', receipt: { id: receiptId } };
      mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
        status: IdempotencyStatus.COMPLETED,
        responseData: cachedResponse,
      });

      const result = await service.postReceipt(
        companyId,
        userId,
        receiptId,
        undefined,
        'idem-key-1',
      );

      expect(result).toEqual(cachedResponse);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if idempotency record is currently IN_PROGRESS', async () => {
      mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
        status: IdempotencyStatus.IN_PROGRESS,
      });

      await expect(
        service.postReceipt(companyId, userId, receiptId, undefined, 'idem-key-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('voidReceipt', () => {
    const mockPostedReceipt = {
      id: receiptId,
      companyId,
      warehouseId: 'wh-1',
      supplierId: 'supp-1',
      receiptNumber: 'REC-2026-001',
      status: ReceiptStatus.POSTED,
      receiptDate: new Date('2026-03-15'),
      postingDate: new Date('2026-03-15'),
      journalEntryId: 'je-1',
      subtotal: new Prisma.Decimal('100.0000'),
      taxAmount: new Prisma.Decimal('0.0000'),
      totalAmount: new Prisma.Decimal('100.0000'),
      version: 2,
    };

    const mockLines = [
      {
        id: 'line-1',
        receiptId,
        itemId: 'item-1',
        lineNumber: 1,
        quantityReceived: new Prisma.Decimal('10.0000'),
        unitCost: new Prisma.Decimal('10.0000'),
        subtotal: new Prisma.Decimal('100.0000'),
        taxAmount: new Prisma.Decimal('0.0000'),
        totalAmount: new Prisma.Decimal('100.0000'),
        item: { id: 'item-1', sku: 'ITEM-STEEL-01' },
      },
    ];

    it('should successfully void a posted receipt when stock is intact', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([mockPostedReceipt]);
      mockPrisma.receiptLine.findMany.mockResolvedValue(mockLines);

      // On-hand stock is sufficient (10 >= 10)
      mockStockBalanceService.lockBalanceForUpdate.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal('15.0000'),
      });

      mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({
        id: 'period-1',
        name: 'FY2026-03',
      });

      mockPrisma.stockMovement.findFirst.mockResolvedValue({
        id: 'm-original-1',
      });

      mockInventoryLedger.reverseMovement.mockResolvedValue({
        reversalMovement: { id: 'm-reversal-1' },
      });

      const mockAssetAccount = { id: 'acc-asset', code: '1200', name: 'Inventory Asset' };
      const mockClearingAccount = { id: 'acc-clearing', code: '2100', name: 'GRN Clearing' };
      const itemMap = new Map();
      itemMap.set('item-1', mockAssetAccount);

      mockInventoryAccounts.resolveReceiptAccounts.mockResolvedValue({
        grnClearingAccount: mockClearingAccount,
        itemAssetAccounts: itemMap,
      });

      mockJournalValidator.validate.mockResolvedValue({
        isValid: true,
        period: { id: 'period-1', name: 'FY2026-03' },
        totalDebit: new Prisma.Decimal('100.0000'),
        totalCredit: new Prisma.Decimal('100.0000'),
        lines: [
          {
            accountId: 'acc-clearing',
            lineNumber: 1,
            debit: new Prisma.Decimal('100.0000'),
            credit: new Prisma.Decimal('0.0000'),
          },
          {
            accountId: 'acc-asset',
            lineNumber: 2,
            debit: new Prisma.Decimal('0.0000'),
            credit: new Prisma.Decimal('100.0000'),
          },
        ],
      });

      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'je-reversal-1',
        entryNumber: 'JE-2026-00002',
      });

      mockPrisma.receipt.update.mockResolvedValue({
        ...mockPostedReceipt,
        status: ReceiptStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: 'Damaged goods return',
      });

      const result = await service.voidReceipt(companyId, userId, receiptId, {
        reason: 'Damaged goods return',
      });

      expect(result).toBeDefined();
      expect(result.receipt.status).toBe(ReceiptStatus.VOIDED);
      expect(mockInventoryLedger.reverseMovement).toHaveBeenCalledTimes(1);
      expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith({
        where: { id: 'je-1' },
        data: { status: JournalEntryStatus.VOIDED },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'RECEIPT_VOIDED',
          entityType: 'Receipt',
        }),
      );
      expect(mockOutboxService.createEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'RECEIPT_VOIDED',
          aggregateType: 'Receipt',
        }),
      );
    });

    it('should throw ConflictException if on-hand stock is less than received quantity (unsafe reversal)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([mockPostedReceipt]);
      mockPrisma.receiptLine.findMany.mockResolvedValue(mockLines);

      // On-hand stock is insufficient (5 < 10)
      mockStockBalanceService.lockBalanceForUpdate.mockResolvedValue({
        quantityOnHand: new Prisma.Decimal('5.0000'),
      });

      await expect(
        service.voidReceipt(companyId, userId, receiptId, { reason: 'Test' }),
      ).rejects.toThrow(ConflictException);

      expect(mockInventoryLedger.reverseMovement).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if attempting to void a DRAFT receipt', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockPostedReceipt, status: ReceiptStatus.DRAFT },
      ]);

      await expect(service.voidReceipt(companyId, userId, receiptId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if attempting to void an already VOIDED receipt', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockPostedReceipt, status: ReceiptStatus.VOIDED },
      ]);

      await expect(service.voidReceipt(companyId, userId, receiptId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

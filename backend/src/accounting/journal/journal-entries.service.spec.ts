import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JournalEntryStatus, JournalSourceType, Prisma } from '@prisma/client';
import { JournalEntriesService } from './journal-entries.service';
import { JournalValidatorService } from './journal-validator.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JournalEntriesService (Unit)', () => {
  let service: JournalEntriesService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockValidator: any;

  const companyId = 'comp-1';
  const userId = 'user-1';

  beforeEach(async () => {
    mockPrisma = {
      journalEntry: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockValidator = {
      validate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEntriesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JournalValidatorService, useValue: mockValidator },
      ],
    }).compile();

    service = module.get<JournalEntriesService>(JournalEntriesService);
  });

  describe('createDraft()', () => {
    it('should validate and persist draft journal entry inside transaction', async () => {
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        period: { id: 'p-1', name: 'FY2026-M10' },
        totalDebit: new Prisma.Decimal('100.0000'),
        totalCredit: new Prisma.Decimal('100.0000'),
        lines: [
          {
            accountId: 'acc-1',
            accountCode: '1200',
            accountName: 'Inventory',
            lineNumber: 1,
            debit: new Prisma.Decimal('100.0000'),
            credit: new Prisma.Decimal('0.0000'),
          },
          {
            accountId: 'acc-2',
            accountCode: '2100',
            accountName: 'GRN Clearing',
            lineNumber: 2,
            debit: new Prisma.Decimal('0.0000'),
            credit: new Prisma.Decimal('100.0000'),
          },
        ],
      });

      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        entryNumber: 'JE-2026-00001',
        status: JournalEntryStatus.DRAFT,
        totalDebit: new Prisma.Decimal('100.0000'),
        totalCredit: new Prisma.Decimal('100.0000'),
      });

      const result = await service.createDraft(companyId, userId, {
        entryDate: '2026-10-15T00:00:00Z',
        description: 'Inventory purchase manual voucher',
        sourceType: JournalSourceType.MANUAL,
        lines: [
          { accountId: 'acc-1', debit: '100', credit: '0' },
          { accountId: 'acc-2', debit: '0', credit: '100' },
        ],
      });

      expect(result.status).toBe(JournalEntryStatus.DRAFT);
      expect(mockValidator.validate).toHaveBeenCalled();
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
    });

    it('should reject invalid date string', async () => {
      await expect(
        service.createDraft(companyId, userId, {
          entryDate: 'invalid-date-xyz',
          description: 'Test entry',
          lines: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate entryNumber if specified', async () => {
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        period: { id: 'p-1', name: 'FY2026-M10' },
        totalDebit: new Prisma.Decimal('100'),
        totalCredit: new Prisma.Decimal('100'),
        lines: [],
      });
      mockPrisma.journalEntry.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createDraft(companyId, userId, {
          entryNumber: 'DUPLICATE-JE-01',
          entryDate: '2026-10-15T00:00:00Z',
          description: 'Test entry',
          lines: [
            { accountId: 'acc-1', debit: '100', credit: '0' },
            { accountId: 'acc-2', debit: '0', credit: '100' },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getEntryById()', () => {
    it('should return journal entry when found in company', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        id: 'je-1',
        companyId,
        entryNumber: 'JE-2026-00001',
      });

      const result = await service.getEntryById(companyId, 'je-1');
      expect(result.entryNumber).toBe('JE-2026-00001');
    });

    it('should throw NotFoundException if not found or cross-company', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.getEntryById(companyId, 'foreign-je')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateDraft()', () => {
    it('should return validation summary without creating DB record', async () => {
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        period: { id: 'p-1', name: 'FY2026-M10' },
        totalDebit: new Prisma.Decimal('250.0000'),
        totalCredit: new Prisma.Decimal('250.0000'),
        lines: [
          {
            accountId: 'acc-1',
            accountCode: '1200',
            accountName: 'Inventory',
            lineNumber: 1,
            debit: new Prisma.Decimal('250.0000'),
            credit: new Prisma.Decimal('0.0000'),
          },
          {
            accountId: 'acc-2',
            accountCode: '2100',
            accountName: 'GRN Clearing',
            lineNumber: 2,
            debit: new Prisma.Decimal('0.0000'),
            credit: new Prisma.Decimal('250.0000'),
          },
        ],
      });

      const result = await service.validateDraft(companyId, {
        entryDate: '2026-10-15T00:00:00Z',
        description: 'Voucher preview',
        lines: [
          { accountId: 'acc-1', debit: '250', credit: '0' },
          { accountId: 'acc-2', debit: '0', credit: '250' },
        ],
      });

      expect(result.isValid).toBe(true);
      expect(result.totalDebit).toBe('250.0000');
      expect(result.totalCredit).toBe('250.0000');
      expect(mockPrisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountNormalBalance, AccountType, Prisma } from '@prisma/client';
import { JournalValidatorService } from './journal-validator.service';
import { AccountingPeriodsService } from '../periods/accounting-periods.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JournalValidatorService (Unit)', () => {
  let service: JournalValidatorService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPeriodsService: any;

  const companyId = 'comp-1';
  const entryDate = new Date('2026-10-15T12:00:00Z');

  beforeEach(async () => {
    mockPrisma = {
      account: {
        findMany: jest.fn(),
      },
    };

    mockPeriodsService = {
      getEligibleOpenPeriod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalValidatorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountingPeriodsService, useValue: mockPeriodsService },
      ],
    }).compile();

    service = module.get<JournalValidatorService>(JournalValidatorService);
  });

  it('should validate a valid, balanced double-entry journal', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({
      id: 'p-1',
      name: 'FY2026-M10',
    });

    mockPrisma.account.findMany.mockResolvedValue([
      {
        id: 'acc-1',
        code: '1200',
        name: 'Inventory',
        type: AccountType.ASSET,
        normalBalance: AccountNormalBalance.DEBIT,
        isActive: true,
        companyId,
      },
      {
        id: 'acc-2',
        code: '2100',
        name: 'GRN Clearing',
        type: AccountType.LIABILITY,
        normalBalance: AccountNormalBalance.CREDIT,
        isActive: true,
        companyId,
      },
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '150.2500', credit: '0' },
      { accountId: 'acc-2', debit: '0', credit: '150.2500' },
    ];

    const result = await service.validate(companyId, entryDate, lines);

    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toEqual(new Prisma.Decimal('150.2500'));
    expect(result.totalCredit).toEqual(new Prisma.Decimal('150.2500'));
    expect(result.lines).toHaveLength(2);
  });

  it('should reject when total debit does not equal total credit', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({ id: 'p-1', name: 'FY2026-M10' });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory', isActive: true, companyId },
      { id: 'acc-2', code: '2100', name: 'GRN Clearing', isActive: true, companyId },
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '100.0000', credit: '0' },
      { accountId: 'acc-2', debit: '0', credit: '99.9999' }, // 0.0001 difference!
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /Journal entry is out of balance/i,
    );
  });

  it('should reject a journal with fewer than 2 lines', async () => {
    await expect(
      service.validate(companyId, entryDate, [{ accountId: 'acc-1', debit: '100', credit: '0' }]),
    ).rejects.toThrow(/at least 2 lines/i);
  });

  it('should reject when a line has both positive debit and positive credit', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({ id: 'p-1', name: 'FY2026-M10' });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory', isActive: true, companyId },
      { id: 'acc-2', code: '2100', name: 'GRN Clearing', isActive: true, companyId },
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '50.0000', credit: '50.0000' }, // Invalid!
      { accountId: 'acc-2', debit: '0.0000', credit: '0.0000' },
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /cannot have both positive debit and credit amounts/i,
    );
  });

  it('should reject zero-value line item', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({ id: 'p-1', name: 'FY2026-M10' });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory', isActive: true, companyId },
      { id: 'acc-2', code: '2100', name: 'GRN Clearing', isActive: true, companyId },
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '0.0000', credit: '0.0000' }, // Invalid!
      { accountId: 'acc-2', debit: '0.0000', credit: '0.0000' },
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /zero debit and zero credit/i,
    );
  });

  it('should reject negative amount on any line', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({ id: 'p-1', name: 'FY2026-M10' });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory', isActive: true, companyId },
      { id: 'acc-2', code: '2100', name: 'GRN Clearing', isActive: true, companyId },
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '-50.0000', credit: '0' },
      { accountId: 'acc-2', debit: '0', credit: '50.0000' },
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /amounts must be non-negative/i,
    );
  });

  it('should reject cross-company or missing accounts', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({ id: 'p-1', name: 'FY2026-M10' });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory', isActive: true, companyId },
      // acc-foreign is missing because query filters by companyId
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '100.0000', credit: '0' },
      { accountId: 'acc-foreign', debit: '0', credit: '100.0000' },
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /cross-company or invalid account IDs/i,
    );
  });

  it('should reject inactive account', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockResolvedValue({ id: 'p-1', name: 'FY2026-M10' });
    mockPrisma.account.findMany.mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory', isActive: true, companyId },
      { id: 'acc-2', code: '2100', name: 'GRN Clearing', isActive: false, companyId }, // Inactive!
    ]);

    const lines = [
      { accountId: 'acc-1', debit: '100.0000', credit: '0' },
      { accountId: 'acc-2', debit: '0', credit: '100.0000' },
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /Cannot use inactive account/i,
    );
  });

  it('should reject when date falls outside open accounting periods', async () => {
    mockPeriodsService.getEligibleOpenPeriod.mockRejectedValue(
      new BadRequestException('belongs to closed accounting period'),
    );

    const lines = [
      { accountId: 'acc-1', debit: '100.0000', credit: '0' },
      { accountId: 'acc-2', debit: '0', credit: '100.0000' },
    ];

    await expect(service.validate(companyId, entryDate, lines)).rejects.toThrow(
      /belongs to closed accounting period/i,
    );
  });
});

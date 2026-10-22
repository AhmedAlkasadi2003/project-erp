import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PeriodStatus } from '@prisma/client';
import { AccountingPeriodsService } from './accounting-periods.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountingPeriodsService (Unit)', () => {
  let service: AccountingPeriodsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  const companyId = 'comp-1';

  beforeEach(async () => {
    mockPrisma = {
      accountingPeriod: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountingPeriodsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AccountingPeriodsService>(AccountingPeriodsService);
  });

  describe('createPeriod()', () => {
    it('should create an accounting period successfully', async () => {
      mockPrisma.accountingPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null); // No overlap
      mockPrisma.accountingPeriod.create.mockResolvedValue({
        id: 'p-1',
        companyId,
        name: 'FY2026-M11',
        startDate: new Date('2026-11-01T00:00:00Z'),
        endDate: new Date('2026-11-30T23:59:59Z'),
        status: PeriodStatus.OPEN,
      });

      const result = await service.createPeriod(companyId, {
        name: 'FY2026-M11',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T23:59:59Z',
      });

      expect(result.name).toBe('FY2026-M11');
      expect(result.status).toBe(PeriodStatus.OPEN);
    });

    it('should reject when startDate is after endDate', async () => {
      await expect(
        service.createPeriod(companyId, {
          name: 'Invalid-Dates',
          startDate: '2026-12-01T00:00:00Z',
          endDate: '2026-11-01T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate period name within same company', async () => {
      mockPrisma.accountingPeriod.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createPeriod(companyId, {
          name: 'FY2026-M10',
          startDate: '2026-10-01T00:00:00Z',
          endDate: '2026-10-31T23:59:59Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject overlapping period within same company', async () => {
      mockPrisma.accountingPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        id: 'p-existing',
        name: 'FY2026-M10',
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-31T23:59:59Z'),
      });

      await expect(
        service.createPeriod(companyId, {
          name: 'FY2026-Overlap',
          startDate: '2026-10-15T00:00:00Z',
          endDate: '2026-11-15T00:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('closePeriod()', () => {
    it('should close an open period successfully', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        id: 'p-1',
        companyId,
        name: 'FY2026-M10',
        status: PeriodStatus.OPEN,
      });
      mockPrisma.accountingPeriod.update.mockResolvedValue({
        id: 'p-1',
        status: PeriodStatus.CLOSED,
      });

      const result = await service.closePeriod(companyId, 'p-1');
      expect(result.status).toBe(PeriodStatus.CLOSED);
    });

    it('should reject closing an already closed period', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        id: 'p-1',
        companyId,
        name: 'FY2026-M10',
        status: PeriodStatus.CLOSED,
      });

      await expect(service.closePeriod(companyId, 'p-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if period belongs to another company', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null);

      await expect(service.closePeriod(companyId, 'foreign-p')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEligibleOpenPeriod()', () => {
    it('should return open period covering the transaction date', async () => {
      const date = new Date('2026-10-15T10:00:00Z');
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p-open',
        name: 'FY2026-M10',
        status: PeriodStatus.OPEN,
      });

      const period = await service.getEligibleOpenPeriod(companyId, date);
      expect(period.name).toBe('FY2026-M10');
    });

    it('should reject with descriptive error when date falls in a closed period', async () => {
      const date = new Date('2026-09-15T10:00:00Z');
      mockPrisma.accountingPeriod.findFirst
        .mockResolvedValueOnce(null) // No open period
        .mockResolvedValueOnce({
          id: 'p-closed',
          name: 'FY2026-M09',
          status: PeriodStatus.CLOSED,
        });

      await expect(service.getEligibleOpenPeriod(companyId, date)).rejects.toThrow(
        /belongs to closed accounting period/i,
      );
    });

    it('should reject when no period exists at all for the date', async () => {
      const date = new Date('2024-01-01T00:00:00Z');
      mockPrisma.accountingPeriod.findFirst
        .mockResolvedValueOnce(null) // No open period
        .mockResolvedValueOnce(null); // No closed period

      await expect(service.getEligibleOpenPeriod(companyId, date)).rejects.toThrow(
        /No active accounting period found/i,
      );
    });
  });
});

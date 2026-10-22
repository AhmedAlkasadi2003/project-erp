import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountNormalBalance, AccountType } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountsService (Unit)', () => {
  let service: AccountsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  const companyId = 'comp-1';

  beforeEach(async () => {
    mockPrisma = {
      account: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      company: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe('createAccount()', () => {
    it('should create an account successfully', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue({
        id: 'acc-1',
        companyId,
        code: '1200',
        name: 'Inventory',
        type: AccountType.ASSET,
        normalBalance: AccountNormalBalance.DEBIT,
        isActive: true,
      });

      const result = await service.createAccount(companyId, {
        code: '1200',
        name: 'Inventory',
        type: AccountType.ASSET,
        normalBalance: AccountNormalBalance.DEBIT,
      });

      expect(result.code).toBe('1200');
      expect(mockPrisma.account.create).toHaveBeenCalled();
    });

    it('should reject duplicate account code within same company', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({ id: 'existing', code: '1200' });

      await expect(
        service.createAccount(companyId, {
          code: '1200',
          name: 'Inventory Duplicate',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject parent account from another company', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      mockPrisma.account.findFirst.mockResolvedValue(null); // Not found in companyId

      await expect(
        service.createAccount(companyId, {
          code: '1210',
          name: 'Sub-Inventory',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          parentId: 'cross-company-parent-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject inactive parent account', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'parent-1',
        companyId,
        isActive: false,
      });

      await expect(
        service.createAccount(companyId, {
          code: '1210',
          name: 'Sub-Inventory',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          parentId: 'parent-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAccountById()', () => {
    it('should retrieve account by ID in same company', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        companyId,
        code: '1200',
        name: 'Inventory',
      });

      const result = await service.getAccountById(companyId, 'acc-1');
      expect(result.id).toBe('acc-1');
    });

    it('should throw NotFoundException if account belongs to another company', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.getAccountById(companyId, 'foreign-acc')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAccount()', () => {
    it('should reject self-parenting (parentId === id)', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        companyId,
        code: '1200',
      });

      await expect(
        service.updateAccount(companyId, 'acc-1', { parentId: 'acc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cyclic account hierarchy', async () => {
      mockPrisma.account.findFirst
        .mockResolvedValueOnce({ id: 'acc-A', companyId, parentId: null }) // target account
        .mockResolvedValueOnce({ id: 'acc-B', companyId, parentId: 'acc-A' }); // candidate parent whose parent is acc-A!

      await expect(
        service.updateAccount(companyId, 'acc-A', { parentId: 'acc-B' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAccount()', () => {
    it('should reject deleting account with child accounts', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        code: '1000',
        _count: { children: 1, journalLines: 0, assetItems: 0, cogsItems: 0, expenseItems: 0 },
      });

      await expect(service.deleteAccount(companyId, 'acc-1')).rejects.toThrow(ConflictException);
    });

    it('should reject deleting account referenced by journal entries', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        code: '1200',
        _count: { children: 0, journalLines: 5, assetItems: 0, cogsItems: 0, expenseItems: 0 },
      });

      await expect(service.deleteAccount(companyId, 'acc-1')).rejects.toThrow(ConflictException);
    });

    it('should reject deleting account configured as company GRN clearing account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-2100',
        code: '2100',
        _count: { children: 0, journalLines: 0, assetItems: 0, cogsItems: 0, expenseItems: 0 },
      });
      mockPrisma.company.findUnique.mockResolvedValue({
        id: companyId,
        grnClearingAccountId: 'acc-2100',
      });

      await expect(service.deleteAccount(companyId, 'acc-2100')).rejects.toThrow(ConflictException);
    });

    it('should delete clean, unreferenced account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-clean',
        code: '9999',
        _count: { children: 0, journalLines: 0, assetItems: 0, cogsItems: 0, expenseItems: 0 },
      });
      mockPrisma.company.findUnique.mockResolvedValue({
        id: companyId,
        grnClearingAccountId: 'acc-2100',
      });
      mockPrisma.account.delete.mockResolvedValue({ id: 'acc-clean' });

      const result = await service.deleteAccount(companyId, 'acc-clean');
      expect(result.deletedAccountId).toBe('acc-clean');
      expect(mockPrisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc-clean' } });
    });
  });
});

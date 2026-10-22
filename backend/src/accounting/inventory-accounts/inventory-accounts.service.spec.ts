import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountNormalBalance, AccountType } from '@prisma/client';
import { InventoryAccountsService } from './inventory-accounts.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryAccountsService (Unit)', () => {
  let service: InventoryAccountsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  const companyId = 'comp-1';

  beforeEach(async () => {
    mockPrisma = {
      company: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      item: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryAccountsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<InventoryAccountsService>(InventoryAccountsService);
  });

  describe('updateInventoryAccountsConfig()', () => {
    it('should successfully update GRN clearing account when valid LIABILITY account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-2100',
        companyId,
        code: '2100',
        name: 'GRN Clearing',
        type: AccountType.LIABILITY,
        isActive: true,
      });
      mockPrisma.company.update.mockResolvedValue({
        id: companyId,
        grnClearingAccountId: 'acc-2100',
        grnClearingAccount: { id: 'acc-2100', code: '2100' },
      });

      const result = await service.updateInventoryAccountsConfig(companyId, {
        grnClearingAccountId: 'acc-2100',
      });

      expect(result.message).toContain('GRN Clearing account updated successfully');
      expect(mockPrisma.company.update).toHaveBeenCalled();
    });

    it('should reject if account not found in company', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInventoryAccountsConfig(companyId, {
          grnClearingAccountId: 'foreign-acc',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if account is inactive', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-inactive',
        companyId,
        code: '2100',
        isActive: false,
        type: AccountType.LIABILITY,
      });

      await expect(
        service.updateInventoryAccountsConfig(companyId, {
          grnClearingAccountId: 'acc-inactive',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if account type is not LIABILITY', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-asset',
        companyId,
        code: '1200',
        isActive: true,
        type: AccountType.ASSET, // Wrong type! Must be LIABILITY
      });

      await expect(
        service.updateInventoryAccountsConfig(companyId, {
          grnClearingAccountId: 'acc-asset',
        }),
      ).rejects.toThrow(/must be of classification LIABILITY/);
    });
  });

  describe('resolveReceiptAccounts()', () => {
    it('should resolve GRN clearing and item asset accounts correctly', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: companyId,
        grnClearingAccountId: 'acc-2100',
        grnClearingAccount: {
          id: 'acc-2100',
          code: '2100',
          name: 'GRN Clearing',
          type: AccountType.LIABILITY,
          normalBalance: AccountNormalBalance.CREDIT,
          isActive: true,
        },
      });

      mockPrisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          sku: 'SKU-STEEL',
          isActive: true,
          assetAccountId: 'acc-1200',
          assetAccount: {
            id: 'acc-1200',
            companyId,
            code: '1200',
            name: 'Inventory Asset',
            type: AccountType.ASSET,
            isActive: true,
          },
        },
      ]);

      const result = await service.resolveReceiptAccounts(companyId, ['item-1']);

      expect(result.grnClearingAccount.code).toBe('2100');
      expect(result.itemAssetAccounts.get('item-1')?.code).toBe('1200');
    });

    it('should throw if company has no configured GRN clearing account', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: companyId,
        grnClearingAccountId: null,
        grnClearingAccount: null,
      });

      await expect(service.resolveReceiptAccounts(companyId, ['item-1'])).rejects.toThrow(
        /Company has no GRN Clearing Account configured/i,
      );
    });

    it('should throw if item asset account is inactive', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: companyId,
        grnClearingAccountId: 'acc-2100',
        grnClearingAccount: {
          id: 'acc-2100',
          code: '2100',
          type: AccountType.LIABILITY,
          isActive: true,
        },
      });

      mockPrisma.item.findMany.mockResolvedValue([
        {
          id: 'item-1',
          sku: 'SKU-STEEL',
          isActive: true,
          assetAccount: {
            id: 'acc-1200',
            companyId,
            code: '1200',
            type: AccountType.ASSET,
            isActive: false, // Inactive!
          },
        },
      ]);

      await expect(service.resolveReceiptAccounts(companyId, ['item-1'])).rejects.toThrow(
        /references inactive Inventory Asset account/i,
      );
    });
  });
});

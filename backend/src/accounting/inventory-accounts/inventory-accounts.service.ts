import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateInventoryAccountsConfigDto } from './dto/update-inventory-accounts-config.dto';

@Injectable()
export class InventoryAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventoryAccountsConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        code: true,
        name: true,
        grnClearingAccountId: true,
        grnClearingAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            normalBalance: true,
            isActive: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found`);
    }

    return {
      companyId: company.id,
      companyCode: company.code,
      companyName: company.name,
      grnClearingAccountId: company.grnClearingAccountId,
      grnClearingAccount: company.grnClearingAccount,
    };
  }

  async updateInventoryAccountsConfig(companyId: string, dto: UpdateInventoryAccountsConfigDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.grnClearingAccountId, companyId },
    });

    if (!account) {
      throw new NotFoundException(
        `Account with ID "${dto.grnClearingAccountId}" not found in this company`,
      );
    }

    if (!account.isActive) {
      throw new BadRequestException(
        `Cannot set inactive account "${account.code}" as GRN Clearing account`,
      );
    }

    if (account.type !== AccountType.LIABILITY) {
      throw new BadRequestException(
        `GRN Clearing account must be of classification LIABILITY (account "${account.code}" is ${account.type})`,
      );
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { grnClearingAccountId: account.id },
      select: {
        id: true,
        grnClearingAccountId: true,
        grnClearingAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            normalBalance: true,
            isActive: true,
          },
        },
      },
    });

    return {
      message: `GRN Clearing account updated successfully to "${account.code} - ${account.name}"`,
      config: updated,
    };
  }

  /**
   * Reusable domain method to resolve and validate both the GRN Clearing account
   * and the Inventory Asset accounts for a batch of receipt line item IDs.
   * Enforces that all accounts belong to company, are active, and have correct accounting classifications.
   */
  async resolveReceiptAccounts(
    companyId: string,
    itemIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    const company = await client.company.findUnique({
      where: { id: companyId },
      include: { grnClearingAccount: true },
    });

    if (!company || !company.grnClearingAccountId || !company.grnClearingAccount) {
      throw new BadRequestException(
        'Company has no GRN Clearing Account configured. Please configure an active GRN Clearing account before executing receipt accounting postings.',
      );
    }

    const grnClearingAccount = company.grnClearingAccount;

    if (!grnClearingAccount.isActive) {
      throw new BadRequestException(
        `Configured GRN Clearing account "${grnClearingAccount.code}" is inactive. Active account required for posting.`,
      );
    }

    if (grnClearingAccount.type !== AccountType.LIABILITY) {
      throw new BadRequestException(
        `Configured GRN Clearing account "${grnClearingAccount.code}" must be of classification LIABILITY.`,
      );
    }

    // Fetch items with asset accounts
    const uniqueItemIds = Array.from(new Set(itemIds));
    const items = await client.item.findMany({
      where: { id: { in: uniqueItemIds }, companyId },
      include: { assetAccount: true },
    });

    if (items.length !== uniqueItemIds.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missing = uniqueItemIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `One or more receipt items were not found in this company: ${missing.join(', ')}`,
      );
    }

    const itemAssetAccounts = new Map<string, (typeof items)[0]['assetAccount']>();

    for (const item of items) {
      if (!item.isActive) {
        throw new BadRequestException(`Item "${item.sku}" is inactive and cannot be received.`);
      }

      if (!item.assetAccount) {
        throw new BadRequestException(`Item "${item.sku}" has no Inventory Asset account linked.`);
      }

      if (item.assetAccount.companyId !== companyId) {
        throw new BadRequestException(
          `Item "${item.sku}" references an asset account belonging to a different company.`,
        );
      }

      if (!item.assetAccount.isActive) {
        throw new BadRequestException(
          `Item "${item.sku}" references inactive Inventory Asset account "${item.assetAccount.code}".`,
        );
      }

      if (item.assetAccount.type !== AccountType.ASSET) {
        throw new BadRequestException(
          `Item "${item.sku}" asset account "${item.assetAccount.code}" must be of classification ASSET.`,
        );
      }

      itemAssetAccounts.set(item.id, item.assetAccount);
    }

    return {
      grnClearingAccount,
      itemAssetAccounts,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { QueryAccountsDto } from './dto/query-accounts.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(companyId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: dto.code.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Account with code "${dto.code.trim()}" already exists for this company`,
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, companyId },
      });

      if (!parent) {
        throw new BadRequestException('Parent account not found in this company');
      }

      if (!parent.isActive) {
        throw new BadRequestException('Cannot assign an inactive account as parent');
      }
    }

    return this.prisma.account.create({
      data: {
        companyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        type: dto.type,
        normalBalance: dto.normalBalance,
        description: dto.description?.trim(),
        parentId: dto.parentId || null,
        isActive: dto.isActive ?? true,
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });
  }

  async getAccountById(companyId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
      include: {
        parent: {
          select: { id: true, code: true, name: true, type: true },
        },
        _count: {
          select: {
            children: true,
            journalLines: true,
            assetItems: true,
            cogsItems: true,
            expenseItems: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID "${id}" not found in this company`);
    }

    return account;
  }

  async listAccounts(companyId: string, query: QueryAccountsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountWhereInput = { companyId };

    if (query.type) {
      where.type = query.type;
    }

    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.AccountOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'code';
    const sortOrder = query.sortOrder || 'asc';
    orderBy[sortField] = sortOrder;

    const [items, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          parent: {
            select: { id: true, code: true, name: true },
          },
          _count: {
            select: { children: true, journalLines: true },
          },
        },
      }),
      this.prisma.account.count({ where }),
    ]);

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page,
      },
    };
  }

  async updateAccount(companyId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID "${id}" not found in this company`);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('An account cannot be its own parent');
      }

      if (dto.parentId !== null) {
        const parent = await this.prisma.account.findFirst({
          where: { id: dto.parentId, companyId },
        });

        if (!parent) {
          throw new BadRequestException('Parent account not found in this company');
        }

        if (!parent.isActive) {
          throw new BadRequestException('Cannot assign an inactive account as parent');
        }

        // Prevent cyclic hierarchies: check if candidate parent is a descendant of current account
        let currentParentId: string | null = parent.parentId;
        while (currentParentId) {
          if (currentParentId === id) {
            throw new BadRequestException(
              'Cyclic account hierarchy detected: an account cannot be a child of its own descendant',
            );
          }
          const nextParent = await this.prisma.account.findUnique({
            where: { id: currentParentId },
            select: { parentId: true },
          });
          currentParentId = nextParent?.parentId || null;
        }
      }
    }

    return this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.normalBalance !== undefined ? { normalBalance: dto.normalBalance } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });
  }

  async deleteAccount(companyId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            children: true,
            journalLines: true,
            assetItems: true,
            cogsItems: true,
            expenseItems: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID "${id}" not found in this company`);
    }

    if (account._count.children > 0) {
      throw new ConflictException(
        'Cannot delete account that has child accounts. Reassign or delete children first.',
      );
    }

    if (account._count.journalLines > 0) {
      throw new ConflictException(
        'Cannot delete account referenced by financial journal entries. Deactivate it instead.',
      );
    }

    if (
      account._count.assetItems > 0 ||
      account._count.cogsItems > 0 ||
      account._count.expenseItems > 0
    ) {
      throw new ConflictException(
        'Cannot delete account referenced by item master records. Reassign items first.',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { grnClearingAccountId: true },
    });

    if (company?.grnClearingAccountId === id) {
      throw new ConflictException(
        'Cannot delete account configured as the company GRN clearing account.',
      );
    }

    await this.prisma.account.delete({
      where: { id },
    });

    return {
      message: `Account "${account.code}" deleted successfully`,
      deletedAccountId: id,
    };
  }
}

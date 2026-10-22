import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { UpdateAccountingPeriodDto } from './dto/update-accounting-period.dto';
import { QueryAccountingPeriodsDto } from './dto/query-accounting-periods.dto';

@Injectable()
export class AccountingPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPeriod(companyId: string, dto: CreateAccountingPeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate provided');
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        `Period startDate (${startDate.toISOString()}) cannot be after endDate (${endDate.toISOString()})`,
      );
    }

    const existingName = await this.prisma.accountingPeriod.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: dto.name.trim(),
        },
      },
    });

    if (existingName) {
      throw new ConflictException(
        `Accounting period with name "${dto.name.trim()}" already exists for this company`,
      );
    }

    // Enforce no overlapping periods within the same company
    const overlapping = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Period dates overlap with existing period "${overlapping.name}" (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)})`,
      );
    }

    return this.prisma.accountingPeriod.create({
      data: {
        companyId,
        name: dto.name.trim(),
        startDate,
        endDate,
        status: dto.status ?? PeriodStatus.OPEN,
      },
    });
  }

  async getPeriodById(companyId: string, id: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: { journalEntries: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period with ID "${id}" not found in this company`);
    }

    return period;
  }

  async listPeriods(companyId: string, query: QueryAccountingPeriodsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountingPeriodWhereInput = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim().length > 0) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const orderBy: Prisma.AccountingPeriodOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'startDate';
    const sortOrder = query.sortOrder || 'asc';
    orderBy[sortField] = sortOrder;

    const [items, total] = await Promise.all([
      this.prisma.accountingPeriod.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { journalEntries: true },
          },
        },
      }),
      this.prisma.accountingPeriod.count({ where }),
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

  async updatePeriod(companyId: string, id: string, dto: UpdateAccountingPeriodDto) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, companyId },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period with ID "${id}" not found in this company`);
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : period.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : period.endDate;

    if (startDate > endDate) {
      throw new BadRequestException('Period startDate cannot be after endDate');
    }

    // If dates changed, verify no overlap with other periods
    if (dto.startDate || dto.endDate) {
      if (period.status === PeriodStatus.CLOSED) {
        throw new BadRequestException(
          'Cannot change date boundaries of a CLOSED accounting period',
        );
      }

      const overlapping = await this.prisma.accountingPeriod.findFirst({
        where: {
          companyId,
          id: { not: id },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });

      if (overlapping) {
        throw new ConflictException(
          `Updated dates overlap with existing period "${overlapping.name}"`,
        );
      }
    }

    return this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async closePeriod(companyId: string, id: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, companyId },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period with ID "${id}" not found in this company`);
    }

    if (period.status === PeriodStatus.CLOSED) {
      throw new BadRequestException(`Accounting period "${period.name}" is already closed`);
    }

    return this.prisma.accountingPeriod.update({
      where: { id },
      data: { status: PeriodStatus.CLOSED },
    });
  }

  /**
   * Reusable domain method to find and validate an eligible OPEN accounting period
   * for a given transaction date. Throws descriptive domain errors if closed or missing.
   */
  async getEligibleOpenPeriod(
    companyId: string,
    transactionDate: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    const openPeriod = await client.accountingPeriod.findFirst({
      where: {
        companyId,
        status: PeriodStatus.OPEN,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
    });

    if (openPeriod) {
      return openPeriod;
    }

    // Check if the date belongs to a CLOSED period to provide a precise accounting error
    const closedPeriod = await client.accountingPeriod.findFirst({
      where: {
        companyId,
        status: PeriodStatus.CLOSED,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
    });

    if (closedPeriod) {
      throw new BadRequestException(
        `Transaction date (${transactionDate.toISOString().slice(0, 10)}) belongs to closed accounting period "${closedPeriod.name}". Postings to closed periods are strictly forbidden.`,
      );
    }

    throw new BadRequestException(
      `No active accounting period found covering transaction date (${transactionDate.toISOString().slice(0, 10)}). Please create or open an accounting period first.`,
    );
  }

  /**
   * Fast non-throwing check whether a transaction date falls in an open period
   */
  async isDateInOpenPeriod(
    companyId: string,
    transactionDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = tx || this.prisma;
    const count = await client.accountingPeriod.count({
      where: {
        companyId,
        status: PeriodStatus.OPEN,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
    });
    return count > 0;
  }
}

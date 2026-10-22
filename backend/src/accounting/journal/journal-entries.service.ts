import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalEntryStatus, JournalSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalValidatorService } from './journal-validator.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { QueryJournalEntriesDto } from './dto/query-journal-entries.dto';
import { ValidateJournalDto } from './dto/validate-journal.dto';

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalValidator: JournalValidatorService,
  ) {}

  async createDraft(companyId: string, userId: string, dto: CreateJournalEntryDto) {
    const entryDate = new Date(dto.entryDate);
    if (isNaN(entryDate.getTime())) {
      throw new BadRequestException('Invalid entryDate provided');
    }

    // 1. Full Double-Entry Domain Validation
    const validationResult = await this.journalValidator.validate(companyId, entryDate, dto.lines);

    // 2. Generate or verify entryNumber
    let entryNumber = dto.entryNumber?.trim();
    if (entryNumber) {
      const existing = await this.prisma.journalEntry.findUnique({
        where: {
          companyId_entryNumber: {
            companyId,
            entryNumber,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Journal entry with number "${entryNumber}" already exists for this company`,
        );
      }
    } else {
      entryNumber = await this.generateEntryNumber(companyId, entryDate);
    }

    // 3. Persist Draft in a Transaction
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          periodId: validationResult.period.id,
          entryNumber: entryNumber!,
          entryDate,
          status: JournalEntryStatus.DRAFT,
          sourceType: dto.sourceType ?? JournalSourceType.MANUAL,
          sourceReference: dto.sourceReference?.trim(),
          description: dto.description.trim(),
          totalDebit: validationResult.totalDebit,
          totalCredit: validationResult.totalCredit,
          createdById: userId,
          lines: {
            create: validationResult.lines.map((l) => ({
              accountId: l.accountId,
              lineNumber: l.lineNumber,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        },
        include: {
          period: { select: { id: true, name: true, status: true } },
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: {
              account: { select: { id: true, code: true, name: true, type: true } },
            },
          },
        },
      });

      return entry;
    });
  }

  async getEntryById(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        period: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        postedBy: { select: { id: true, name: true, email: true } },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true, normalBalance: true },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with ID "${id}" not found in this company`);
    }

    return entry;
  }

  async listEntries(companyId: string, query: QueryJournalEntriesDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.periodId) {
      where.periodId = query.periodId;
    }

    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }

    if (query.startDate || query.endDate) {
      where.entryDate = {};
      if (query.startDate) where.entryDate.gte = new Date(query.startDate);
      if (query.endDate) where.entryDate.lte = new Date(query.endDate);
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sourceReference: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.JournalEntryOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'entryDate';
    const sortOrder = query.sortOrder || 'desc';
    orderBy[sortField] = sortOrder;

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          period: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.journalEntry.count({ where }),
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

  async validateDraft(companyId: string, dto: ValidateJournalDto) {
    const entryDate = new Date(dto.entryDate);
    if (isNaN(entryDate.getTime())) {
      throw new BadRequestException('Invalid entryDate provided');
    }

    const validationResult = await this.journalValidator.validate(companyId, entryDate, dto.lines);

    return {
      isValid: true,
      period: validationResult.period,
      totalDebit: validationResult.totalDebit.toFixed(4),
      totalCredit: validationResult.totalCredit.toFixed(4),
      lineCount: validationResult.lines.length,
      lines: validationResult.lines.map((l) => ({
        lineNumber: l.lineNumber,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.debit.toFixed(4),
        credit: l.credit.toFixed(4),
        description: l.description,
      })),
      message: 'Journal entry is balanced and valid for posting',
    };
  }

  async generateEntryNumber(
    companyId: string,
    entryDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx || this.prisma;
    const year = entryDate.getFullYear();
    const count = await client.journalEntry.count({
      where: {
        companyId,
        entryDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59),
        },
      },
    });

    const nextSeq = (count + 1).toString().padStart(5, '0');
    return `JE-${year}-${nextSeq}`;
  }
}

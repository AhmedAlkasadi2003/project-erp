import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingPeriodsService } from '../periods/accounting-periods.service';
import { CreateJournalLineDto } from './dto/create-journal-line.dto';

export interface ValidatedJournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  lineNumber: number;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  description?: string;
}

export interface JournalValidationResult {
  isValid: boolean;
  period: { id: string; name: string };
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  lines: ValidatedJournalLine[];
}

@Injectable()
export class JournalValidatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodsService: AccountingPeriodsService,
  ) {}

  async validate(
    companyId: string,
    entryDate: Date,
    rawLines: CreateJournalLineDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<JournalValidationResult> {
    const client = tx || this.prisma;

    // 1. Double-Entry Minimum Line Count Rule
    if (!rawLines || rawLines.length < 2) {
      throw new BadRequestException(
        'A journal entry must contain at least 2 lines (double-entry accounting rule)',
      );
    }

    // 2. Validate Accounting Period Eligibility
    const period = await this.periodsService.getEligibleOpenPeriod(companyId, entryDate, tx);

    // 3. Collect Unique Accounts & Validate Ownership & Active Status
    const accountIds = Array.from(new Set(rawLines.map((l) => l.accountId)));
    const accounts = await client.account.findMany({
      where: {
        id: { in: accountIds },
        companyId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
        isActive: true,
        companyId: true,
      },
    });

    const accountMap = new Map<string, (typeof accounts)[0]>();
    for (const acc of accounts) {
      accountMap.set(acc.id, acc);
    }

    if (accountMap.size !== accountIds.length) {
      const missingIds = accountIds.filter((id) => !accountMap.has(id));
      throw new BadRequestException(
        `One or more accounts were not found in this company (cross-company or invalid account IDs): ${missingIds.join(', ')}`,
      );
    }

    // 4. Line-by-Line Validation & Financial Precision Rounding
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    const validatedLines: ValidatedJournalLine[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const account = accountMap.get(line.accountId);

      if (!account) {
        throw new BadRequestException(`Account "${line.accountId}" does not exist`);
      }

      if (!account.isActive) {
        throw new BadRequestException(
          `Cannot use inactive account "${account.code} - ${account.name}" in line ${i + 1}`,
        );
      }

      let debit: Prisma.Decimal;
      let credit: Prisma.Decimal;

      try {
        debit = new Prisma.Decimal(line.debit ?? 0).toDecimalPlaces(
          4,
          Prisma.Decimal.ROUND_HALF_UP,
        );
      } catch {
        throw new BadRequestException(`Invalid debit amount in line ${i + 1}`);
      }

      try {
        credit = new Prisma.Decimal(line.credit ?? 0).toDecimalPlaces(
          4,
          Prisma.Decimal.ROUND_HALF_UP,
        );
      } catch {
        throw new BadRequestException(`Invalid credit amount in line ${i + 1}`);
      }

      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(
          `Line ${i + 1} amounts must be non-negative (debit: ${debit.toFixed(4)}, credit: ${credit.toFixed(4)})`,
        );
      }

      // Single-leg rule: A line cannot carry both positive debit and positive credit
      if (debit.isPositive() && !debit.isZero() && credit.isPositive() && !credit.isZero()) {
        throw new BadRequestException(
          `Line ${i + 1} cannot have both positive debit and credit amounts. Each line must be either a debit or a credit.`,
        );
      }

      // Zero-value lines are strictly invalid
      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException(
          `Line ${i + 1} has zero debit and zero credit. Zero-value legs are invalid in double-entry bookkeeping.`,
        );
      }

      totalDebit = totalDebit.add(debit);
      totalCredit = totalCredit.add(credit);

      validatedLines.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        lineNumber: i + 1,
        debit,
        credit,
        description: line.description?.trim(),
      });
    }

    // 5. Exact Double-Entry Balance Verification at Decimal(19, 4)
    totalDebit = totalDebit.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    totalCredit = totalCredit.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

    if (!totalDebit.equals(totalCredit)) {
      const difference = totalDebit.minus(totalCredit).abs().toFixed(4);
      throw new BadRequestException(
        `Journal entry is out of balance. Total debits (${totalDebit.toFixed(4)}) must equal total credits (${totalCredit.toFixed(4)}). Imbalance: ${difference}`,
      );
    }

    return {
      isValid: true,
      period: { id: period.id, name: period.name },
      totalDebit,
      totalCredit,
      lines: validatedLines,
    };
  }
}

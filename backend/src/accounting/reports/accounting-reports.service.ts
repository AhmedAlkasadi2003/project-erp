import { Injectable, BadRequestException } from '@nestjs/common';
import { JournalEntryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TrialBalanceAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  totalDebit: string;
  totalCredit: string;
  netDebit: string;
  netCredit: string;
}

export interface TrialBalanceResult {
  asOfDate: string;
  periodId: string | null;
  accounts: TrialBalanceAccountRow[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}

export interface InventoryGlReconciliationResult {
  asOfDate: string;
  subledgerTotalValue: string;
  glInventoryAssetTotal: string;
  delta: string;
  isReconciled: boolean;
  assetAccounts: Array<{
    accountId: string;
    code: string;
    name: string;
    balance: string;
  }>;
}

@Injectable()
export class AccountingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a formal Trial Balance report for the company.
   * Aggregates all posted journal entries up to asOfDate.
   */
  async getTrialBalance(
    companyId: string,
    query?: { asOfDate?: string; periodId?: string },
  ): Promise<TrialBalanceResult> {
    const asOf = query?.asOfDate ? new Date(query.asOfDate) : new Date();
    if (isNaN(asOf.getTime())) {
      throw new BadRequestException('Invalid asOfDate provided');
    }

    const whereEntry: Prisma.JournalEntryWhereInput = {
      companyId,
      status: JournalEntryStatus.POSTED,
      entryDate: { lte: asOf },
    };

    if (query?.periodId) {
      whereEntry.periodId = query.periodId;
    }

    // 1. Fetch all accounts for the tenant
    const accounts = await this.prisma.account.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });

    // 2. Aggregate debit and credit lines from posted entries
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: whereEntry,
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    // 3. Map line sums per account
    const accountTotals = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    for (const acc of accounts) {
      accountTotals.set(acc.id, {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      });
    }

    for (const line of journalLines) {
      const current = accountTotals.get(line.accountId);
      if (current) {
        current.debit = current.debit.plus(line.debit);
        current.credit = current.credit.plus(line.credit);
      }
    }

    let grandTotalDebit = new Prisma.Decimal(0);
    let grandTotalCredit = new Prisma.Decimal(0);

    const accountRows: TrialBalanceAccountRow[] = [];

    for (const acc of accounts) {
      const totals = accountTotals.get(acc.id)!;
      const debitDec = totals.debit;
      const creditDec = totals.credit;

      // Net columns: if Net is debit, netDebit > 0 else netCredit > 0
      const diff = debitDec.minus(creditDec);
      let netDebit = new Prisma.Decimal(0);
      let netCredit = new Prisma.Decimal(0);

      if (diff.greaterThan(0)) {
        netDebit = diff;
      } else if (diff.lessThan(0)) {
        netCredit = diff.abs();
      }

      grandTotalDebit = grandTotalDebit.plus(netDebit);
      grandTotalCredit = grandTotalCredit.plus(netCredit);

      accountRows.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        totalDebit: debitDec.toFixed(4),
        totalCredit: creditDec.toFixed(4),
        netDebit: netDebit.toFixed(4),
        netCredit: netCredit.toFixed(4),
      });
    }

    const isBalanced = grandTotalDebit.equals(grandTotalCredit);

    return {
      asOfDate: asOf.toISOString(),
      periodId: query?.periodId ?? null,
      accounts: accountRows,
      totalDebit: grandTotalDebit.toFixed(4),
      totalCredit: grandTotalCredit.toFixed(4),
      isBalanced,
    };
  }

  /**
   * Reconciles the Inventory Sub-ledger (StockBalance) with the General Ledger (Inventory Asset accounts).
   */
  async getInventoryGlReconciliation(companyId: string): Promise<InventoryGlReconciliationResult> {
    const asOf = new Date();

    // 1. Sub-ledger Total Value: sum of all StockBalance.totalValue for company
    const balanceAggregate = await this.prisma.stockBalance.aggregate({
      where: { companyId },
      _sum: {
        totalValue: true,
      },
    });

    const subledgerTotalValue = balanceAggregate._sum.totalValue ?? new Prisma.Decimal(0);

    // 2. Identify all Asset Accounts configured on items in this company
    const items = await this.prisma.item.findMany({
      where: { companyId },
      select: { assetAccountId: true },
    });

    const assetAccountIds = Array.from(new Set(items.map((i) => i.assetAccountId)));

    // Fetch accounts metadata
    const assetAccounts = await this.prisma.account.findMany({
      where: {
        companyId,
        id: { in: assetAccountIds },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { code: 'asc' },
    });

    // 3. Aggregate net posted journal lines for these asset accounts
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: assetAccountIds },
        journalEntry: {
          companyId,
          status: JournalEntryStatus.POSTED,
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    const accountBalances = new Map<string, Prisma.Decimal>();
    for (const acc of assetAccounts) {
      accountBalances.set(acc.id, new Prisma.Decimal(0));
    }

    let glInventoryAssetTotal = new Prisma.Decimal(0);

    for (const line of lines) {
      const current = accountBalances.get(line.accountId) ?? new Prisma.Decimal(0);
      const updated = current.plus(line.debit).minus(line.credit);
      accountBalances.set(line.accountId, updated);
      glInventoryAssetTotal = glInventoryAssetTotal.plus(line.debit).minus(line.credit);
    }

    const delta = subledgerTotalValue.minus(glInventoryAssetTotal);
    const isReconciled = delta.abs().lessThanOrEqualTo(new Prisma.Decimal('0.0001'));

    return {
      asOfDate: asOf.toISOString(),
      subledgerTotalValue: subledgerTotalValue.toFixed(4),
      glInventoryAssetTotal: glInventoryAssetTotal.toFixed(4),
      delta: delta.toFixed(4),
      isReconciled,
      assetAccounts: assetAccounts.map((acc) => ({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        balance: (accountBalances.get(acc.id) ?? new Prisma.Decimal(0)).toFixed(4),
      })),
    };
  }
}

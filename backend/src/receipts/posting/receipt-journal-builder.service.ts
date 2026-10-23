import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ReceiptLineForJournal {
  id: string;
  lineNumber: number;
  itemId: string;
  totalAmount: Prisma.Decimal;
}

export interface ResolvedAccount {
  id: string;
  code: string;
  name: string;
}

export interface JournalLineDto {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

@Injectable()
export class ReceiptJournalBuilderService {
  /**
   * Constructs double-entry lines for posting an inventory receipt:
   * Debit: Inventory Asset account per line
   * Credit: Accrued Inventory (GRN Clearing account) for total receipt valuation
   */
  buildPostingLines(
    receiptNumber: string,
    receiptTotalAmount: Prisma.Decimal,
    lines: ReceiptLineForJournal[],
    grnClearingAccount: ResolvedAccount,
    itemAssetAccounts: Map<string, ResolvedAccount>,
  ): JournalLineDto[] {
    const journalLinesDto: JournalLineDto[] = [];

    for (const line of lines) {
      const assetAccount = itemAssetAccounts.get(line.itemId);
      if (!assetAccount) {
        throw new BadRequestException(
          `Missing resolved Inventory Asset account for item '${line.itemId}'`,
        );
      }

      journalLinesDto.push({
        accountId: assetAccount.id,
        debit: line.totalAmount.toString(),
        credit: '0.0000',
        description: `Receipt line ${line.lineNumber} - Item asset debit`,
      });
    }

    journalLinesDto.push({
      accountId: grnClearingAccount.id,
      debit: '0.0000',
      credit: receiptTotalAmount.toString(),
      description: `GRN Clearing credit - Receipt ${receiptNumber}`,
    });

    return journalLinesDto;
  }

  /**
   * Constructs double-entry lines for voiding/reversing an inventory receipt:
   * Debit: GRN Clearing account (reversing the liability)
   * Credit: Inventory Asset account per line (reversing the asset)
   */
  buildReversingLines(
    receiptNumber: string,
    receiptTotalAmount: Prisma.Decimal,
    lines: ReceiptLineForJournal[],
    grnClearingAccount: ResolvedAccount,
    itemAssetAccounts: Map<string, ResolvedAccount>,
  ): JournalLineDto[] {
    const reversingJournalLinesDto: JournalLineDto[] = [];

    // Debit GRN Clearing to eliminate the accrual liability
    reversingJournalLinesDto.push({
      accountId: grnClearingAccount.id,
      debit: receiptTotalAmount.toString(),
      credit: '0.0000',
      description: `GRN Clearing reversal - Void Receipt ${receiptNumber}`,
    });

    // Credit Inventory Asset accounts to relieve the asset balance
    for (const line of lines) {
      const assetAccount = itemAssetAccounts.get(line.itemId);
      if (!assetAccount) {
        throw new BadRequestException(
          `Missing resolved Inventory Asset account for item '${line.itemId}'`,
        );
      }

      reversingJournalLinesDto.push({
        accountId: assetAccount.id,
        debit: '0.0000',
        credit: line.totalAmount.toString(),
        description: `Receipt line ${line.lineNumber} asset reversal - Void Receipt ${receiptNumber}`,
      });
    }

    return reversingJournalLinesDto;
  }
}

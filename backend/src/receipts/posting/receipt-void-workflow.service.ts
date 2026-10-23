import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdempotencyStatus,
  JournalEntryStatus,
  JournalSourceType,
  Prisma,
  ReceiptStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockBalanceService } from '../../inventory/stock-balance.service';
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { InventoryAccountsService } from '../../accounting/inventory-accounts/inventory-accounts.service';
import { AccountingPeriodsService } from '../../accounting/periods/accounting-periods.service';
import { JournalValidatorService } from '../../accounting/journal/journal-validator.service';
import { JournalEntriesService } from '../../accounting/journal/journal-entries.service';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../../outbox/outbox.service';
import { ReceiptJournalBuilderService } from './receipt-journal-builder.service';
import { VoidReceiptDto } from '../dto/void-receipt.dto';

interface LockedReceiptRow {
  id: string;
  companyId: string;
  warehouseId: string;
  supplierId: string;
  receiptNumber: string;
  status: ReceiptStatus;
  receiptDate: Date;
  postingDate: Date | null;
  journalEntryId: string | null;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  version: number;
}

export interface VoidReceiptResult {
  message: string;
  receipt: Record<string, unknown>;
  reversingJournalEntryId: string;
  reversingJournalNumber: string;
  movementsReversed: number;
}

@Injectable()
export class ReceiptVoidWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockBalanceService: StockBalanceService,
    private readonly inventoryLedger: InventoryLedgerService,
    private readonly inventoryAccounts: InventoryAccountsService,
    private readonly periodsService: AccountingPeriodsService,
    private readonly journalValidator: JournalValidatorService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly journalBuilder: ReceiptJournalBuilderService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * SAFE VOID WORKFLOW
   * Safely voids a posted inventory receipt, ensuring goods have not been issued/consumed,
   * creating compensating reversing stock movements, posting balanced reversing journal entries,
   * and updating receipt status to VOIDED within an atomic ACID transaction.
   */
  async voidReceipt(
    companyId: string,
    userId: string,
    receiptId: string,
    dto?: VoidReceiptDto,
    idempotencyKey?: string,
    correlationId?: string,
    withRetryFn?: <T>(op: () => Promise<T>) => Promise<T>,
  ): Promise<VoidReceiptResult> {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingRecord = await this.prisma.idempotencyRecord.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId,
            idempotencyKey,
          },
        },
      });

      if (existingRecord) {
        if (existingRecord.status === IdempotencyStatus.COMPLETED && existingRecord.responseData) {
          return existingRecord.responseData as unknown as VoidReceiptResult;
        }
        if (existingRecord.status === IdempotencyStatus.IN_PROGRESS) {
          throw new ConflictException(
            'A request with this idempotency key is currently in progress. Please retry shortly.',
          );
        }
      } else {
        await this.prisma.idempotencyRecord.create({
          data: {
            companyId,
            idempotencyKey,
            operation: `VOID_RECEIPT_${receiptId}`,
            status: IdempotencyStatus.IN_PROGRESS,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    const runner = withRetryFn ?? ((op) => op());

    try {
      const result = await runner(async () => {
        return this.prisma.$transaction(
          async (tx) => {
            // Step 1: Acquire exclusive row lock on the receipt
            const lockedRows = await tx.$queryRaw<LockedReceiptRow[]>`
              SELECT id, "companyId", "warehouseId", "supplierId", "receiptNumber", status, "receiptDate", "postingDate", "journalEntryId", subtotal, "taxAmount", "totalAmount", version
              FROM receipts
              WHERE id = ${receiptId} AND "companyId" = ${companyId}
              FOR UPDATE;
            `;

            if (!lockedRows || lockedRows.length === 0) {
              throw new NotFoundException(
                `Receipt with ID '${receiptId}' not found in this company`,
              );
            }

            const receipt = lockedRows[0];

            if (receipt.status === ReceiptStatus.DRAFT) {
              throw new BadRequestException(
                `Cannot void receipt '${receipt.receiptNumber}' because it is in DRAFT status. Draft receipts can be edited or deleted directly.`,
              );
            }

            if (
              receipt.status === ReceiptStatus.VOIDED ||
              receipt.status === ReceiptStatus.CANCELLED
            ) {
              throw new ConflictException(
                `Receipt '${receipt.receiptNumber}' has already been voided/cancelled.`,
              );
            }

            if (receipt.status !== ReceiptStatus.POSTED) {
              throw new BadRequestException(
                `Cannot void receipt with status '${receipt.status}'. Only POSTED receipts can be voided.`,
              );
            }

            if (!receipt.journalEntryId) {
              throw new BadRequestException(
                `Receipt '${receipt.receiptNumber}' has no associated journal entry to void.`,
              );
            }

            // Step 2: Fetch original lines and movements
            const lines = await tx.receiptLine.findMany({
              where: { receiptId: receipt.id },
              orderBy: { lineNumber: 'asc' },
              include: { item: true },
            });

            // Step 3: Check subsequent inventory movements & on-hand stock safety
            // Critical Invariant: If on-hand stock < received quantity, goods were issued/consumed. Voiding is blocked.
            for (const line of lines) {
              const balance = await this.stockBalanceService.lockBalanceForUpdate(
                tx,
                companyId,
                receipt.warehouseId,
                line.itemId,
              );

              if (balance.quantityOnHand.lessThan(line.quantityReceived)) {
                throw new ConflictException(
                  `Cannot void receipt '${receipt.receiptNumber}': Insufficient on-hand stock for item '${line.item.sku}' in warehouse. Available: ${balance.quantityOnHand.toString()}, required to reverse: ${line.quantityReceived.toString()}. Goods have already been issued or consumed.`,
                );
              }
            }

            // Step 4: Validate Accounting Period for Void Date
            const voidDate = dto?.voidDate ? new Date(dto.voidDate) : new Date();
            if (isNaN(voidDate.getTime())) {
              throw new BadRequestException('Invalid voidDate provided');
            }

            const openPeriod = await this.periodsService.getEligibleOpenPeriod(
              companyId,
              voidDate,
              tx,
            );

            // Step 5: Reverse Stock Movements
            // Sort lines deterministically by itemId to avoid lock contention
            const sortedLines = [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
            const reversingMovements = [];

            for (const line of sortedLines) {
              const originalMovement = await tx.stockMovement.findFirst({
                where: {
                  receiptId: receipt.id,
                  receiptLineId: line.id,
                  movementType: StockMovementType.RECEIPT,
                },
              });

              if (!originalMovement) {
                throw new NotFoundException(
                  `Original stock movement for receipt line ${line.lineNumber} was not found`,
                );
              }

              const reversalResult = await this.inventoryLedger.reverseMovement(
                {
                  companyId,
                  movementId: originalMovement.id,
                  userId,
                  reason: dto?.reason,
                },
                tx,
              );
              reversingMovements.push(reversalResult.reversalMovement);
            }

            // Step 6: Create Balanced Reversing General Ledger Journal Entry
            const { grnClearingAccount, itemAssetAccounts } =
              await this.inventoryAccounts.resolveReceiptAccounts(
                companyId,
                lines.map((l) => l.itemId),
                tx,
              );

            const reversingJournalLinesDto = this.journalBuilder.buildReversingLines(
              receipt.receiptNumber,
              receipt.totalAmount,
              lines,
              grnClearingAccount,
              itemAssetAccounts,
            );

            // Validate reversing journal balancing
            const validationResult = await this.journalValidator.validate(
              companyId,
              voidDate,
              reversingJournalLinesDto,
              tx,
            );

            const reversingEntryNumber = await this.journalEntriesService.generateEntryNumber(
              companyId,
              voidDate,
              tx,
            );

            const reversingJournal = await tx.journalEntry.create({
              data: {
                companyId,
                periodId: openPeriod.id,
                entryNumber: reversingEntryNumber,
                entryDate: voidDate,
                postingDate: voidDate,
                status: JournalEntryStatus.POSTED,
                sourceType: JournalSourceType.RECEIPT,
                sourceReference: `VOID-${receipt.receiptNumber}`,
                description: `Reversal / Void of Receipt ${receipt.receiptNumber}${dto?.reason ? ': ' + dto.reason : ''}`,
                totalDebit: validationResult.totalDebit,
                totalCredit: validationResult.totalCredit,
                createdById: userId,
                postedById: userId,
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
            });

            // Step 7: Transition original Journal Entry status to VOIDED
            await tx.journalEntry.update({
              where: { id: receipt.journalEntryId },
              data: { status: JournalEntryStatus.VOIDED },
            });

            // Step 8: Transition Receipt status to VOIDED
            const voidReason = dto?.voidReason?.trim() || dto?.reason?.trim() || 'Voided by user';
            const voidedReceipt = await tx.receipt.update({
              where: { id: receipt.id },
              data: {
                status: ReceiptStatus.VOIDED,
                voidedAt: voidDate,
                voidedById: userId,
                voidReason,
                version: { increment: 1 },
              },
              include: {
                lines: {
                  include: {
                    item: {
                      select: { id: true, sku: true, name: true, uom: true, valuationMethod: true },
                    },
                  },
                  orderBy: { lineNumber: 'asc' },
                },
                warehouse: { select: { id: true, code: true, name: true } },
                supplier: { select: { id: true, code: true, name: true } },
                postedByUser: { select: { id: true, name: true, email: true } },
                voidedByUser: { select: { id: true, name: true, email: true } },
                journalEntry: {
                  include: {
                    lines: {
                      include: {
                        account: { select: { id: true, code: true, name: true, type: true } },
                      },
                      orderBy: { lineNumber: 'asc' },
                    },
                  },
                },
              },
            });

            // Step 9: Record Audit Event
            await this.auditService.record(tx, {
              companyId,
              userId,
              action: 'RECEIPT_VOIDED',
              entityType: 'Receipt',
              entityId: receipt.id,
              changes: {
                previousStatus: ReceiptStatus.POSTED,
                newStatus: ReceiptStatus.VOIDED,
                originalJournalEntryId: receipt.journalEntryId,
                reversingJournalEntryId: reversingJournal.id,
                reversingJournalNumber: reversingJournal.entryNumber,
                voidReason,
                movementsReversed: reversingMovements.length,
                voidDate: voidDate.toISOString(),
              },
              correlationId,
            });

            // Step 10: Create Transactional Outbox Event within the exact same transaction
            await this.outboxService.createEvent(tx, {
              companyId,
              aggregateType: 'Receipt',
              aggregateId: receipt.id,
              eventType: 'RECEIPT_VOIDED',
              eventVersion: 1,
              payload: {
                receiptId: receipt.id,
                receiptNumber: receipt.receiptNumber,
                companyId,
                voidReason,
                originalJournalEntryId: receipt.journalEntryId,
                reversingJournalEntryId: reversingJournal.id,
                reversingJournalNumber: reversingJournal.entryNumber,
                movementsReversedCount: reversingMovements.length,
                voidedAt: new Date().toISOString(),
              },
            });

            return {
              message: `Receipt '${receipt.receiptNumber}' was successfully voided and reversed.`,
              receipt: voidedReceipt,
              reversingJournalEntryId: reversingJournal.id,
              reversingJournalNumber: reversingJournal.entryNumber,
              movementsReversed: reversingMovements.length,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            timeout: 15000,
          },
        );
      });

      // Update idempotency record to COMPLETED on success
      if (idempotencyKey) {
        await this.prisma.idempotencyRecord.update({
          where: {
            companyId_idempotencyKey: {
              companyId,
              idempotencyKey,
            },
          },
          data: {
            status: IdempotencyStatus.COMPLETED,
            responseData: result as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return result;
    } catch (error) {
      if (idempotencyKey) {
        await this.prisma.idempotencyRecord
          .delete({
            where: {
              companyId_idempotencyKey: {
                companyId,
                idempotencyKey,
              },
            },
          })
          .catch(() => {});
      }
      throw error;
    }
  }
}

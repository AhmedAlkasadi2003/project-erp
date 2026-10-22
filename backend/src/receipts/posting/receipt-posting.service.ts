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
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { StockBalanceService } from '../../inventory/stock-balance.service';
import { InventoryAccountsService } from '../../accounting/inventory-accounts/inventory-accounts.service';
import { AccountingPeriodsService } from '../../accounting/periods/accounting-periods.service';
import { JournalValidatorService } from '../../accounting/journal/journal-validator.service';
import { JournalEntriesService } from '../../accounting/journal/journal-entries.service';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../../outbox/outbox.service';
import { PostReceiptDto } from '../dto/post-receipt.dto';
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

export interface PostReceiptResult {
  message: string;
  receipt: Record<string, unknown>;
  journalEntryId: string;
  journalEntryNumber: string;
  movementsCreated: number;
}

export interface VoidReceiptResult {
  message: string;
  receipt: Record<string, unknown>;
  reversingJournalEntryId: string;
  reversingJournalNumber: string;
  movementsReversed: number;
}

@Injectable()
export class ReceiptPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLedger: InventoryLedgerService,
    private readonly stockBalanceService: StockBalanceService,
    private readonly inventoryAccounts: InventoryAccountsService,
    private readonly periodsService: AccountingPeriodsService,
    private readonly journalValidator: JournalValidatorService,
    private readonly journalEntriesService: JournalEntriesService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Executes a database transaction with bounded jittered retries for transient concurrency errors.
   */
  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (err: unknown) {
        attempts++;
        if (this.isTransientConcurrencyError(err) && attempts < maxRetries) {
          const jitter = Math.floor(Math.random() * 30) + attempts * 40;
          await new Promise((resolve) => setTimeout(resolve, jitter));
          continue;
        }
        throw err;
      }
    }
    return operation();
  }

  private isTransientConcurrencyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2034' || err.code === '40001' || err.code === '40P01') {
      return true;
    }
    if (
      err.message &&
      (err.message.includes('deadlock') || err.message.includes('could not serialize'))
    ) {
      return true;
    }
    return false;
  }

  /**
   * ATOMIC RECEIPT POSTING
   * Transition receipt from DRAFT to POSTED, update inventory ledger and weighted average costs,
   * generate balanced General Ledger double-entry journal, and record audit trail within a single ACID transaction.
   */
  async postReceipt(
    companyId: string,
    userId: string,
    receiptId: string,
    dto?: PostReceiptDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<PostReceiptResult> {
    // 1. Idempotency Check (if key provided)
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
          return existingRecord.responseData as unknown as PostReceiptResult;
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
            operation: `POST_RECEIPT_${receiptId}`,
            status: IdempotencyStatus.IN_PROGRESS,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });
      }
    }

    try {
      const result = await this.withRetry(async () => {
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

            // If already posted, reject concurrent conflicting attempt
            if (receipt.status === ReceiptStatus.POSTED) {
              throw new ConflictException(
                `Receipt '${receipt.receiptNumber}' has already been posted.`,
              );
            }

            if (receipt.status !== ReceiptStatus.DRAFT) {
              throw new BadRequestException(
                `Cannot post receipt with status '${receipt.status}'. Only DRAFT receipts can be posted.`,
              );
            }

            // Step 2: Fetch and validate receipt lines
            const lines = await tx.receiptLine.findMany({
              where: { receiptId: receipt.id },
              orderBy: { lineNumber: 'asc' },
            });

            if (!lines || lines.length === 0) {
              throw new BadRequestException(
                `Receipt '${receipt.receiptNumber}' contains no line items and cannot be posted.`,
              );
            }

            // Step 3: Validate warehouse and supplier are active in this company
            const warehouse = await tx.warehouse.findFirst({
              where: { id: receipt.warehouseId, companyId, isActive: true },
            });
            if (!warehouse) {
              throw new BadRequestException(
                `Warehouse '${receipt.warehouseId}' is invalid or inactive for this company`,
              );
            }

            const supplier = await tx.supplier.findFirst({
              where: { id: receipt.supplierId, companyId, isActive: true },
            });
            if (!supplier) {
              throw new BadRequestException(
                `Supplier '${receipt.supplierId}' is invalid or inactive for this company`,
              );
            }

            // Step 4: Validate Accounting Period for Posting Date
            const postingDate = dto?.postingDate ? new Date(dto.postingDate) : receipt.receiptDate;
            if (isNaN(postingDate.getTime())) {
              throw new BadRequestException('Invalid postingDate provided');
            }

            const openPeriod = await this.periodsService.getEligibleOpenPeriod(
              companyId,
              postingDate,
              tx,
            );

            // Step 5: Resolve and Validate Inventory Asset Accounts and GRN Clearing Account
            const itemIds = lines.map((l) => l.itemId);
            const { grnClearingAccount, itemAssetAccounts } =
              await this.inventoryAccounts.resolveReceiptAccounts(companyId, itemIds, tx);

            // Step 6: Process Inventory Movements with Deterministic Lock Order (itemId: 'asc')
            // Sorting lines deterministically eliminates deadlock when concurrent receipts touch overlapping items
            const sortedLines = [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
            const createdMovements = [];

            for (const line of sortedLines) {
              const inboundResult = await this.inventoryLedger.recordInboundMovement(
                {
                  companyId,
                  warehouseId: receipt.warehouseId,
                  itemId: line.itemId,
                  quantity: line.quantityReceived,
                  unitCost: line.unitCost,
                  movementType: StockMovementType.RECEIPT,
                  referenceType: 'RECEIPT',
                  referenceId: receipt.id,
                  receiptId: receipt.id,
                  receiptLineId: line.id,
                  userId,
                  movementDate: postingDate,
                },
                tx,
              );
              createdMovements.push(inboundResult.movement);
            }

            // Step 7: Construct Balanced Double-Entry General Ledger Postings
            // Debit: Inventory Asset account for each line valuation
            // Credit: GRN Clearing account for total receipt valuation
            const journalLinesDto = [];

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
              credit: receipt.totalAmount.toString(),
              description: `GRN Clearing credit - Receipt ${receipt.receiptNumber}`,
            });

            // Validate double-entry balancing and business rules
            const validationResult = await this.journalValidator.validate(
              companyId,
              postingDate,
              journalLinesDto,
              tx,
            );

            // Generate official Journal Entry Number
            const entryNumber = await this.journalEntriesService.generateEntryNumber(
              companyId,
              postingDate,
              tx,
            );

            // Persist POSTED Journal Entry
            const journalEntry = await tx.journalEntry.create({
              data: {
                companyId,
                periodId: openPeriod.id,
                entryNumber,
                entryDate: postingDate,
                postingDate,
                status: JournalEntryStatus.POSTED,
                sourceType: JournalSourceType.RECEIPT,
                sourceReference: receipt.receiptNumber,
                description: `Inventory Receipt posting - ${receipt.receiptNumber}${dto?.notes ? ' (' + dto.notes + ')' : ''}`,
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

            // Step 8: Transition Receipt state to POSTED and link journalEntryId
            const updatedReceipt = await tx.receipt.update({
              where: { id: receipt.id },
              data: {
                status: ReceiptStatus.POSTED,
                postingDate,
                postedById: userId,
                journalEntryId: journalEntry.id,
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
              action: 'RECEIPT_POSTED',
              entityType: 'Receipt',
              entityId: receipt.id,
              changes: {
                previousStatus: ReceiptStatus.DRAFT,
                newStatus: ReceiptStatus.POSTED,
                journalEntryId: journalEntry.id,
                entryNumber: journalEntry.entryNumber,
                movementCount: createdMovements.length,
                totalAmount: receipt.totalAmount.toString(),
                postingDate: postingDate.toISOString(),
              },
              correlationId,
            });

            // Step 10: Create Transactional Outbox Event within the exact same transaction
            await this.outboxService.createEvent(tx, {
              companyId,
              aggregateType: 'Receipt',
              aggregateId: receipt.id,
              eventType: 'RECEIPT_POSTED',
              eventVersion: 1,
              payload: {
                receiptId: receipt.id,
                receiptNumber: receipt.receiptNumber,
                companyId,
                totalAmount: receipt.totalAmount.toString(),
                subtotal: receipt.subtotal.toString(),
                taxAmount: receipt.taxAmount.toString(),
                postingDate: postingDate.toISOString(),
                journalEntryId: journalEntry.id,
                journalEntryNumber: journalEntry.entryNumber,
                movementsCount: createdMovements.length,
              },
            });

            return {
              message: `Receipt '${receipt.receiptNumber}' posted successfully.`,
              receipt: updatedReceipt,
              journalEntryId: journalEntry.id,
              journalEntryNumber: journalEntry.entryNumber,
              movementsCreated: createdMovements.length,
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

  /**
   * SAFE VOID WORKFLOW
   * Safely voids a POSTED inventory receipt by verifying on-hand inventory has not been consumed,
   * creating compensating reversing stock movements, generating a balanced reversing General Ledger entry,
   * voiding the original journal entry, and transitioning receipt status to VOIDED atomically.
   */
  async voidReceipt(
    companyId: string,
    userId: string,
    receiptId: string,
    dto?: VoidReceiptDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<VoidReceiptResult> {
    // 1. Idempotency Check (if key provided)
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

    try {
      const result = await this.withRetry(async () => {
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
            // Reversing Entry:
            // Debit: GRN Clearing account (company level)
            // Credit: Item Inventory Asset accounts (per line)
            const { grnClearingAccount, itemAssetAccounts } =
              await this.inventoryAccounts.resolveReceiptAccounts(
                companyId,
                lines.map((l) => l.itemId),
                tx,
              );

            const reversingJournalLinesDto = [];

            // Debit GRN Clearing to eliminate the accrual liability
            reversingJournalLinesDto.push({
              accountId: grnClearingAccount.id,
              debit: receipt.totalAmount.toString(),
              credit: '0.0000',
              description: `GRN Clearing reversal - Void Receipt ${receipt.receiptNumber}`,
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
                description: `Receipt line ${line.lineNumber} asset reversal - Void Receipt ${receipt.receiptNumber}`,
              });
            }

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

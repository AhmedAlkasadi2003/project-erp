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
import { ReceiptJournalBuilderService } from './receipt-journal-builder.service';
import {
  ReceiptVoidWorkflowService,
  VoidReceiptResult,
} from './receipt-void-workflow.service';

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
  notes: string | null;
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

export { VoidReceiptResult };

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
    private readonly journalBuilder: ReceiptJournalBuilderService,
    private readonly voidWorkflow: ReceiptVoidWorkflowService,
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
              SELECT id, "companyId", "warehouseId", "supplierId", "receiptNumber", status, "receiptDate", "postingDate", "journalEntryId", notes, subtotal, "taxAmount", "totalAmount", version
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

            if (receipt.status !== ReceiptStatus.DRAFT) {
              throw new ConflictException(
                `Receipt '${receipt.receiptNumber}' has already been posted or is in status '${receipt.status}'. Only DRAFT receipts can be posted.`,
              );
            }

            // Step 2: Fetch lines with item master attributes
            const lines = await tx.receiptLine.findMany({
              where: { receiptId: receipt.id },
              orderBy: { lineNumber: 'asc' },
              include: { item: true },
            });

            if (lines.length === 0) {
              throw new BadRequestException('Cannot post receipt: Receipt contains no line items');
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

            // Step 7: Construct Balanced Double-Entry General Ledger Postings via JournalBuilder
            const journalLinesDto = this.journalBuilder.buildPostingLines(
              receipt.receiptNumber,
              receipt.totalAmount,
              lines,
              grnClearingAccount,
              itemAssetAccounts,
            );

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
                description: `Inventory receipt posting for ${receipt.receiptNumber}${receipt.notes ? ' - ' + receipt.notes : ''}`,
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

            // Step 8: Transition Receipt status to POSTED
            const postedReceipt = await tx.receipt.update({
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
                journalEntryNumber: journalEntry.entryNumber,
                movementsCreated: createdMovements.length,
                postingDate: postingDate.toISOString(),
              },
              correlationId,
            });

            // Step 10: Create Transactional Outbox Event
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
                warehouseId: receipt.warehouseId,
                supplierId: receipt.supplierId,
                totalAmount: receipt.totalAmount.toString(),
                journalEntryId: journalEntry.id,
                journalEntryNumber: journalEntry.entryNumber,
                lineCount: lines.length,
                postedAt: new Date().toISOString(),
              },
            });

            return {
              message: `Receipt '${receipt.receiptNumber}' was posted successfully to inventory and General Ledger.`,
              receipt: postedReceipt,
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

      // Update idempotency record on success
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
   * Delegates the safe void workflow to ReceiptVoidWorkflowService.
   */
  async voidReceipt(
    companyId: string,
    userId: string,
    receiptId: string,
    dto?: VoidReceiptDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<VoidReceiptResult> {
    return this.voidWorkflow.voidReceipt(
      companyId,
      userId,
      receiptId,
      dto,
      idempotencyKey,
      correlationId,
      (operation) => this.withRetry(operation),
    );
  }
}

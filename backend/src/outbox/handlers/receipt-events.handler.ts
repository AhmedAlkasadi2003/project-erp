import { Injectable, Logger } from '@nestjs/common';
import { IOutboxHandler } from '../interfaces/outbox-event.interface';

@Injectable()
export class ReceiptPostedHandler implements IOutboxHandler {
  private readonly logger = new Logger(ReceiptPostedHandler.name);

  // In-memory or database idempotency tracking for demonstrative consumer delivery
  private readonly processedEvents = new Set<string>();

  async handle(event: {
    id: string;
    companyId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    eventVersion: number;
    payload: Record<string, unknown>;
    createdAt: Date;
  }): Promise<void> {
    if (this.processedEvents.has(event.id)) {
      this.logger.warn(
        `Duplicate event [${event.id}] detected by ReceiptPostedHandler. Skipped duplicate processing (idempotency enforced).`,
      );
      return;
    }

    this.logger.log(
      `Handled RECEIPT_POSTED event for receipt [${event.aggregateId}], company [${event.companyId}], journalEntry [${event.payload.journalEntryNumber || event.payload.journalEntryId}]`,
    );

    this.processedEvents.add(event.id);
  }

  isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }
}

@Injectable()
export class ReceiptVoidedHandler implements IOutboxHandler {
  private readonly logger = new Logger(ReceiptVoidedHandler.name);
  private readonly processedEvents = new Set<string>();

  async handle(event: {
    id: string;
    companyId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    eventVersion: number;
    payload: Record<string, unknown>;
    createdAt: Date;
  }): Promise<void> {
    if (this.processedEvents.has(event.id)) {
      this.logger.warn(
        `Duplicate event [${event.id}] detected by ReceiptVoidedHandler. Skipped duplicate processing (idempotency enforced).`,
      );
      return;
    }

    this.logger.log(
      `Handled RECEIPT_VOIDED event for receipt [${event.aggregateId}], company [${event.companyId}], reversingJournal [${event.payload.reversingJournalNumber || event.payload.reversingJournalEntryId}]`,
    );

    this.processedEvents.add(event.id);
  }

  isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }
}

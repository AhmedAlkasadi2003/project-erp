import { Injectable, Logger } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { CreateOutboxParams } from './interfaces/outbox-event.interface';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  /**
   * Persists an outbox event inside the active PostgreSQL transaction.
   * This guarantees transactional atomicity between business operations
   * (e.g. Receipt posting/voiding) and event generation.
   */
  async createEvent(tx: Prisma.TransactionClient, params: CreateOutboxParams) {
    if (!tx) {
      throw new Error(
        'OutboxService.createEvent MUST be provided an active Prisma.TransactionClient to ensure transactional atomicity.',
      );
    }

    const event = await tx.outboxEvent.create({
      data: {
        companyId: params.companyId,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        eventVersion: params.eventVersion || 1,
        payload: params.payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
        retryCount: 0,
      },
    });

    this.logger.debug(
      `Persisted outbox event [${event.eventType}] for ${event.aggregateType}:${event.aggregateId} (ID: ${event.id})`,
    );

    return event;
  }
}

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IOutboxHandler, OutboxMetrics } from './interfaces/outbox-event.interface';

export interface OutboxProcessorConfig {
  workerId?: string;
  batchSize?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  leaseTimeoutMs?: number;
  pollIntervalMs?: number;
}

@Injectable()
export class OutboxProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxProcessor.name);
  private readonly workerId: string;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly leaseTimeoutMs: number;
  private readonly pollIntervalMs: number;

  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private handlers = new Map<string, IOutboxHandler>();

  constructor(private readonly prisma: PrismaService) {
    this.workerId = `worker-${randomUUID().substring(0, 8)}`;
    this.batchSize = 20;
    this.maxRetries = 5;
    this.baseBackoffMs = 1000;
    this.maxBackoffMs = 30000;
    this.leaseTimeoutMs = 60000; // 60 seconds lease
    this.pollIntervalMs = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '5000', 10);
  }

  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Registers a domain handler for a specific event type.
   */
  registerHandler(eventType: string, handler: IOutboxHandler): void {
    this.handlers.set(eventType, handler);
    this.logger.log(`Registered outbox handler for event type: [${eventType}]`);
  }

  onApplicationBootstrap() {
    if (process.env.OUTBOX_WORKER_ENABLED === 'true') {
      this.start();
    }
  }

  onApplicationShutdown() {
    this.stop();
  }

  /**
   * Starts background recurring polling.
   */
  start(): void {
    if (this.pollTimer) return;
    this.logger.log(
      `Starting Outbox background worker [${this.workerId}], interval: ${this.pollIntervalMs}ms`,
    );
    this.pollTimer = setInterval(async () => {
      try {
        await this.processPendingBatch();
      } catch (err) {
        this.logger.error(
          `Unhandled error in outbox worker loop: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stops background polling gracefully.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.logger.log(`Stopped Outbox worker [${this.workerId}]`);
    }
  }

  /**
   * Recovers events whose processing lease has expired due to worker crash or hang.
   */
  async recoverStaleLeases(leaseTimeoutMs = this.leaseTimeoutMs): Promise<number> {
    const cutoff = new Date(Date.now() - leaseTimeoutMs);
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxStatus.PROCESSING,
        lockedAt: { lt: cutoff },
      },
      data: {
        status: OutboxStatus.PENDING,
        lockedAt: null,
        lockedBy: null,
      },
    });

    if (result.count > 0) {
      this.logger.warn(
        `Recovered ${result.count} stale outbox events stuck in PROCESSING state older than ${cutoff.toISOString()}`,
      );
    }

    return result.count;
  }

  /**
   * Atomically claims a batch of eligible PENDING events using PostgreSQL row-level
   * locking with SKIP LOCKED. Competing worker instances will never lock the same rows.
   */
  async claimBatch(
    workerId = this.workerId,
    batchSize = this.batchSize,
  ): Promise<
    Array<{
      id: string;
      companyId: string;
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      eventVersion: number;
      payload: Prisma.JsonValue;
      retryCount: number;
      createdAt: Date;
    }>
  > {
    return this.prisma.$transaction(
      async (tx) => {
        // Query eligible rows using PostgreSQL row-level locking with SKIP LOCKED
        const eligibleRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "outbox_events"
          WHERE "status" = 'PENDING'::"OutboxStatus"
            AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
          ORDER BY "createdAt" ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;

        if (eligibleRows.length === 0) {
          return [];
        }

        const ids = eligibleRows.map((r) => r.id);
        const now = new Date();

        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: {
            status: OutboxStatus.PROCESSING,
            lockedAt: now,
            lockedBy: workerId,
          },
        });

        // Retrieve the full event data for the claimed IDs within transaction
        const claimed = await tx.outboxEvent.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            companyId: true,
            aggregateType: true,
            aggregateId: true,
            eventType: true,
            eventVersion: true,
            payload: true,
            retryCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        return claimed;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Dispatches and processes a single claimed event outside the claim transaction.
   */
  async processEvent(event: {
    id: string;
    companyId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    eventVersion: number;
    payload: Prisma.JsonValue;
    retryCount: number;
    createdAt: Date;
  }): Promise<boolean> {
    const handler = this.handlers.get(event.eventType);

    try {
      if (handler) {
        await handler.handle({
          id: event.id,
          companyId: event.companyId,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          payload: event.payload as Record<string, unknown>,
          createdAt: event.createdAt,
        });
      } else {
        this.logger.debug(
          `No explicit handler registered for event [${event.eventType}]. Marking PROCESSED (at-least-once log)`,
        );
      }

      // Mark PROCESSED
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });

      return true;
    } catch (err) {
      const errorMsg = (err as Error).message || 'Unknown processing error';
      const isLastAttempt = event.retryCount + 1 >= this.maxRetries;

      if (isLastAttempt) {
        this.logger.error(
          `Event [${event.id}] failed permanently after ${event.retryCount + 1} attempts: ${errorMsg}`,
        );

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.FAILED,
            retryCount: event.retryCount + 1,
            lockedAt: null,
            lockedBy: null,
            lastError: errorMsg.substring(0, 1000),
          },
        });
      } else {
        // Bounded exponential backoff with jitter
        const jitter = Math.floor(Math.random() * 500);
        const backoff = Math.min(
          this.maxBackoffMs,
          this.baseBackoffMs * Math.pow(2, event.retryCount) + jitter,
        );
        const nextRetryAt = new Date(Date.now() + backoff);

        this.logger.warn(
          `Event [${event.id}] attempt ${event.retryCount + 1} failed: ${errorMsg}. Retrying at ${nextRetryAt.toISOString()}`,
        );

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.PENDING,
            retryCount: event.retryCount + 1,
            nextRetryAt,
            lockedAt: null,
            lockedBy: null,
            lastError: errorMsg.substring(0, 1000),
          },
        });
      }

      return false;
    }
  }

  /**
   * Processes a single batch of pending outbox events deterministically.
   * Useful for background processing loop and testing assertions.
   */
  async processPendingBatch(batchSize = this.batchSize): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      // 1. Recover any stale leases first
      await this.recoverStaleLeases();

      // 2. Claim next available batch with SKIP LOCKED
      const batch = await this.claimBatch(this.workerId, batchSize);
      if (batch.length === 0) {
        return 0;
      }

      let successCount = 0;
      for (const event of batch) {
        const success = await this.processEvent(event);
        if (success) successCount++;
      }

      return successCount;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Obtains aggregate operational metrics on outbox event health.
   */
  async getMetrics(companyId?: string): Promise<OutboxMetrics> {
    const where: Prisma.OutboxEventWhereInput = companyId ? { companyId } : {};

    const [pending, processing, processed, failed, deadLetter, oldestPending] = await Promise.all([
      this.prisma.outboxEvent.count({
        where: { ...where, status: OutboxStatus.PENDING },
      }),
      this.prisma.outboxEvent.count({
        where: { ...where, status: OutboxStatus.PROCESSING },
      }),
      this.prisma.outboxEvent.count({
        where: { ...where, status: OutboxStatus.PROCESSED },
      }),
      this.prisma.outboxEvent.count({
        where: { ...where, status: OutboxStatus.FAILED },
      }),
      this.prisma.outboxEvent.count({
        where: { ...where, status: OutboxStatus.DEAD_LETTER },
      }),
      this.prisma.outboxEvent.findFirst({
        where: { ...where, status: OutboxStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const oldestPendingAgeMs = oldestPending
      ? Date.now() - oldestPending.createdAt.getTime()
      : null;

    return {
      pendingCount: pending,
      processingCount: processing,
      processedCount: processed,
      failedCount: failed,
      deadLetterCount: deadLetter,
      oldestPendingAgeMs,
    };
  }

  /**
   * Replays a FAILED or DEAD_LETTER event for controlled operational reprocessing.
   * Strictly enforces company tenancy.
   */
  async replayEvent(companyId: string, eventId: string) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: {
        id: eventId,
        companyId, // Strict company isolation
      },
    });

    if (!event) {
      throw new NotFoundException(`Outbox event '${eventId}' not found`);
    }

    if (event.status !== OutboxStatus.FAILED && event.status !== OutboxStatus.DEAD_LETTER) {
      throw new BadRequestException(
        `Only events in FAILED or DEAD_LETTER status can be replayed. Current status is ${event.status}`,
      );
    }

    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PENDING,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }
}

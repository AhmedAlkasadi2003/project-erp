/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OutboxStatus } from '@prisma/client';
import { OutboxProcessor } from './outbox-processor';
import { PrismaService } from '../prisma/prisma.service';

describe('OutboxProcessor (Unit)', () => {
  let processor: OutboxProcessor;
  let mockPrisma: any;

  const companyId = 'comp-outbox-1';

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      $queryRaw: jest.fn(),
      outboxEvent: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxProcessor, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    processor = module.get<OutboxProcessor>(OutboxProcessor);
  });

  describe('claimBatch()', () => {
    it('should return empty array if no eligible events exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const claimed = await processor.claimBatch('worker-1', 10);
      expect(claimed).toEqual([]);
      expect(mockPrisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });

    it('should atomically claim eligible events and mark status PROCESSING with lease lock', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ev-1' }, { id: 'ev-2' }]);
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.outboxEvent.findMany.mockResolvedValue([
        { id: 'ev-1', eventType: 'RECEIPT_POSTED', retryCount: 0 },
        { id: 'ev-2', eventType: 'RECEIPT_POSTED', retryCount: 0 },
      ]);

      const claimed = await processor.claimBatch('worker-1', 10);

      expect(claimed).toHaveLength(2);
      expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ev-1', 'ev-2'] } },
        data: expect.objectContaining({
          status: OutboxStatus.PROCESSING,
          lockedBy: 'worker-1',
          lockedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('processEvent()', () => {
    const mockEvent = {
      id: 'event-uuid-1',
      companyId,
      aggregateType: 'Receipt',
      aggregateId: 'rec-1',
      eventType: 'RECEIPT_POSTED',
      eventVersion: 1,
      payload: { amount: 100 },
      retryCount: 0,
      createdAt: new Date(),
    };

    it('should mark event PROCESSED when handler executes successfully', async () => {
      const handler = { handle: jest.fn().mockResolvedValue(undefined) };
      processor.registerHandler('RECEIPT_POSTED', handler);

      const success = await processor.processEvent(mockEvent);

      expect(success).toBe(true);
      expect(handler.handle).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-uuid-1' }));
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-uuid-1' },
        data: expect.objectContaining({
          status: OutboxStatus.PROCESSED,
          processedAt: expect.any(Date),
          lockedAt: null,
          lockedBy: null,
        }),
      });
    });

    it('should schedule retry with backoff on transient failure when retryCount < maxRetries', async () => {
      const handler = {
        handle: jest.fn().mockRejectedValue(new Error('Downstream network glitch')),
      };
      processor.registerHandler('RECEIPT_POSTED', handler);

      const success = await processor.processEvent({
        ...mockEvent,
        retryCount: 1,
      });

      expect(success).toBe(false);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-uuid-1' },
        data: expect.objectContaining({
          status: OutboxStatus.PENDING,
          retryCount: 2,
          nextRetryAt: expect.any(Date),
          lockedAt: null,
          lockedBy: null,
          lastError: expect.stringContaining('Downstream network glitch'),
        }),
      });
    });

    it('should mark event FAILED when max retries exceeded', async () => {
      const handler = {
        handle: jest.fn().mockRejectedValue(new Error('Permanent deserialization failure')),
      };
      processor.registerHandler('RECEIPT_POSTED', handler);

      const success = await processor.processEvent({
        ...mockEvent,
        retryCount: 4, // 5th attempt will exceed maxRetries = 5
      });

      expect(success).toBe(false);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-uuid-1' },
        data: expect.objectContaining({
          status: OutboxStatus.FAILED,
          retryCount: 5,
          lockedAt: null,
          lockedBy: null,
          lastError: expect.stringContaining('Permanent deserialization failure'),
        }),
      });
    });
  });

  describe('recoverStaleLeases()', () => {
    it('should reset abandoned PROCESSING events to PENDING', async () => {
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 3 });

      const count = await processor.recoverStaleLeases(60000);

      expect(count).toBe(3);
      expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: {
          status: OutboxStatus.PROCESSING,
          lockedAt: { lt: expect.any(Date) },
        },
        data: {
          status: OutboxStatus.PENDING,
          lockedAt: null,
          lockedBy: null,
        },
      });
    });
  });

  describe('replayEvent()', () => {
    it('should reset a FAILED event to PENDING for reprocessing', async () => {
      mockPrisma.outboxEvent.findFirst.mockResolvedValue({
        id: 'ev-failed-1',
        companyId,
        status: OutboxStatus.FAILED,
      });
      mockPrisma.outboxEvent.update.mockResolvedValue({
        id: 'ev-failed-1',
        status: OutboxStatus.PENDING,
      });

      const replayed = await processor.replayEvent(companyId, 'ev-failed-1');

      expect(replayed.status).toBe(OutboxStatus.PENDING);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'ev-failed-1' },
        data: {
          status: OutboxStatus.PENDING,
          retryCount: 0,
          nextRetryAt: null,
          lastError: null,
          lockedAt: null,
          lockedBy: null,
        },
      });
    });

    it('should reject replay if event is not FAILED or DEAD_LETTER', async () => {
      mockPrisma.outboxEvent.findFirst.mockResolvedValue({
        id: 'ev-processed-1',
        companyId,
        status: OutboxStatus.PROCESSED,
      });

      await expect(processor.replayEvent(companyId, 'ev-processed-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if event does not belong to company', async () => {
      mockPrisma.outboxEvent.findFirst.mockResolvedValue(null);

      await expect(processor.replayEvent(companyId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMetrics()', () => {
    it('should aggregate pending, processing, processed, and failed event counts', async () => {
      mockPrisma.outboxEvent.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2) // processing
        .mockResolvedValueOnce(100) // processed
        .mockResolvedValueOnce(1) // failed
        .mockResolvedValueOnce(0); // dead letter

      mockPrisma.outboxEvent.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 5000),
      });

      const metrics = await processor.getMetrics(companyId);

      expect(metrics.pendingCount).toBe(5);
      expect(metrics.processingCount).toBe(2);
      expect(metrics.processedCount).toBe(100);
      expect(metrics.failedCount).toBe(1);
      expect(metrics.deadLetterCount).toBe(0);
      expect(metrics.oldestPendingAgeMs).toBeGreaterThan(0);
    });
  });
});

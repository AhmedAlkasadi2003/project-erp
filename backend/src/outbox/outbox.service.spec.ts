/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { OutboxStatus } from '@prisma/client';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxService],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  describe('createEvent', () => {
    it('should throw an error if no active transaction client is provided', async () => {
      await expect(
        service.createEvent(null as any, {
          companyId: 'comp-1',
          aggregateType: 'Receipt',
          aggregateId: 'rec-1',
          eventType: 'RECEIPT_POSTED',
          payload: { amount: 100 },
        }),
      ).rejects.toThrow('MUST be provided an active Prisma.TransactionClient');
    });

    it('should create an outbox event with status PENDING and version 1 inside transaction', async () => {
      const mockTx: any = {
        outboxEvent: {
          create: jest.fn().mockResolvedValue({
            id: 'outbox-uuid-1',
            companyId: 'comp-1',
            aggregateType: 'Receipt',
            aggregateId: 'rec-1',
            eventType: 'RECEIPT_POSTED',
            eventVersion: 1,
            payload: { amount: 100 },
            status: OutboxStatus.PENDING,
            retryCount: 0,
          }),
        },
      };

      const result = await service.createEvent(mockTx, {
        companyId: 'comp-1',
        aggregateType: 'Receipt',
        aggregateId: 'rec-1',
        eventType: 'RECEIPT_POSTED',
        payload: { amount: 100 },
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(OutboxStatus.PENDING);
      expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          companyId: 'comp-1',
          aggregateType: 'Receipt',
          aggregateId: 'rec-1',
          eventType: 'RECEIPT_POSTED',
          eventVersion: 1,
          payload: { amount: 100 },
          status: OutboxStatus.PENDING,
          retryCount: 0,
        },
      });
    });
  });
});

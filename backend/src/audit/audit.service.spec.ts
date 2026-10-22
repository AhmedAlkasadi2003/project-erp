/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  const companyId = 'comp-audit-1';
  const userId = 'user-audit-1';

  beforeEach(async () => {
    mockPrisma = {
      auditEvent: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('sanitizeMetadata', () => {
    it('should mask passwords, secrets, tokens, and authorization headers recursively', () => {
      const input = {
        email: 'user@example.com',
        password: 'PlainTextPassword123!',
        authToken: 'eyJhbGciOi...',
        clientSecret: 'secret_live_key',
        nested: {
          refreshToken: 'refresh_xyz',
          passwordHash: '$argon2id$...',
          safeField: 'safeValue',
        },
      };

      const sanitized = service.sanitizeMetadata(input) as any;

      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.authToken).toBe('[REDACTED]');
      expect(sanitized.clientSecret).toBe('[REDACTED]');
      expect(sanitized.nested.refreshToken).toBe('[REDACTED]');
      expect(sanitized.nested.passwordHash).toBe('[REDACTED]');
      expect(sanitized.nested.safeField).toBe('safeValue');
    });

    it('should handle null and undefined safely', () => {
      expect(service.sanitizeMetadata(null)).toBeNull();
      expect(service.sanitizeMetadata(undefined)).toBeUndefined();
    });
  });

  describe('record', () => {
    it('should persist an audit event with sanitized changes and correlation ID', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'event-1' });

      const result = await service.record(mockPrisma, {
        companyId,
        userId,
        action: 'RECEIPT_POSTED',
        entityType: 'Receipt',
        entityId: 'rec-1',
        changes: {
          receiptNumber: 'REC-001',
          userPassword: 'should_be_redacted',
        },
        correlationId: 'req-corr-123',
        ipAddress: '127.0.0.1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          userId,
          action: 'RECEIPT_POSTED',
          entityType: 'Receipt',
          entityId: 'rec-1',
          correlationId: 'req-corr-123',
          ipAddress: '127.0.0.1',
          changes: {
            receiptNumber: 'REC-001',
            userPassword: '[REDACTED]',
          },
        }),
      });
    });
  });

  describe('queryEvents', () => {
    it('should query events enforcing strict company tenant isolation', async () => {
      mockPrisma.auditEvent.count.mockResolvedValue(1);
      mockPrisma.auditEvent.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          companyId,
          action: 'RECEIPT_POSTED',
          entityType: 'Receipt',
          entityId: 'rec-1',
          createdAt: new Date(),
          user: { id: userId, email: 'admin@acme.com', name: 'Admin' },
        },
      ]);

      const result = await service.queryEvents(companyId, {
        page: 1,
        limit: 10,
        action: 'RECEIPT_POSTED',
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId, // Strict isolation
            action: 'RECEIPT_POSTED',
          }),
        }),
      );
    });
  });

  describe('getEventById', () => {
    it('should return event when tenant matches', async () => {
      mockPrisma.auditEvent.findFirst.mockResolvedValue({
        id: 'ev-1',
        companyId,
      });

      const event = await service.getEventById(companyId, 'ev-1');
      expect(event).toBeDefined();
    });

    it('should throw NotFoundException if event does not belong to the company', async () => {
      mockPrisma.auditEvent.findFirst.mockResolvedValue(null);

      await expect(service.getEventById('other-company', 'ev-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

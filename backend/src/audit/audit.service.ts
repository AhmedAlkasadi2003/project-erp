import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditEventsDto } from './dto/query-audit-events.dto';

export interface RecordAuditParams {
  companyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  correlationId?: string | null;
  ipAddress?: string | null;
}

export interface PaginatedAuditResult {
  data: Array<{
    id: string;
    companyId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    changes: unknown;
    correlationId: string | null;
    ipAddress: string | null;
    createdAt: Date;
    user?: {
      id: string;
      email: string;
      name: string;
    } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SENSITIVE_KEY_PATTERNS = [
  /passw(or)?d/i,
  /secret/i,
  /token/i,
  /hash/i,
  /authorization/i,
  /credit[-_]?card/i,
  /cookie/i,
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitizes changes object by masking any sensitive keys like passwords, tokens, hashes.
   */
  sanitizeMetadata(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeMetadata(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeMetadata(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Records an immutable audit log entry.
   * Can be executed within an existing Prisma transaction or standalone.
   */
  async record(
    txOrPrisma: Prisma.TransactionClient | PrismaService | undefined,
    params: RecordAuditParams,
  ) {
    const client = txOrPrisma || this.prisma;
    const sanitizedChanges = params.changes
      ? (this.sanitizeMetadata(params.changes) as Prisma.InputJsonValue)
      : undefined;

    return (client as Prisma.TransactionClient).auditEvent.create({
      data: {
        companyId: params.companyId,
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: sanitizedChanges,
        correlationId: params.correlationId || null,
        ipAddress: params.ipAddress || null,
      },
    });
  }

  /**
   * Safe asynchronous non-blocking recording for security events (e.g. failed login, access rejected)
   * that do not have an open business transaction.
   */
  async recordSecurityEvent(params: RecordAuditParams): Promise<void> {
    try {
      await this.record(this.prisma, params);
    } catch (error) {
      this.logger.error(
        `Failed to record security audit event [${params.action}] for entity [${params.entityId}]: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Queries audit events strictly scoped to the requesting tenant.
   */
  async queryEvents(companyId: string, query: QueryAuditEventsDto): Promise<PaginatedAuditResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {
      companyId, // Mandatory strict tenant isolation
    };

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [total, events] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: events,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves a single audit record, enforcing company tenant scoping.
   */
  async getEventById(companyId: string, id: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: {
        id,
        companyId, // Strict tenant check
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Audit event '${id}' not found`);
    }

    return event;
  }
}

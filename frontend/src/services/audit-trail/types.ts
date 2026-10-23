import type { PaginationMeta } from '../../types/pagination';

export interface AuditEvent {
  id: string;
  companyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
}

export interface QueryAuditEventsParams {
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AuditEventsResponse {
  data: AuditEvent[];
  meta: PaginationMeta;
}

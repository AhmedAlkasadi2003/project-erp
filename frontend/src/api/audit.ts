import { apiClient } from './client';
import { AuditEvent, PaginatedResponse, PaginationMeta } from '../types';

export interface QueryAuditEventsParams {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  userId?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
}

export async function getAuditEvents(
  params?: QueryAuditEventsParams,
): Promise<PaginatedResponse<AuditEvent>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.entityType) query.set('entityType', params.entityType);
  if (params?.action) query.set('action', params.action);
  if (params?.userId) query.set('userId', params.userId);
  if (params?.entityId) query.set('entityId', params.entityId);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);

  const qs = query.toString();
  const raw = await apiClient<{
    data?: AuditEvent[];
    items?: AuditEvent[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    meta?: PaginationMeta;
  }>(qs ? `audit-events?${qs}` : 'audit-events');

  const events = raw.data || raw.items || [];
  const meta: PaginationMeta = raw.meta || {
    total: raw.total || events.length,
    page: raw.page || 1,
    limit: raw.limit || 20,
    totalPages: raw.totalPages || 1,
    hasNextPage: (raw.page || 1) < (raw.totalPages || 1),
    hasPrevPage: (raw.page || 1) > 1,
  };

  return {
    data: events,
    meta,
  };
}

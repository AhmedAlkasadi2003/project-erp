import { apiClient } from '../client';
import { AuditEvent, AuditEventsResponse, QueryAuditEventsParams } from './types';

export async function getAuditEvents(
  params: QueryAuditEventsParams = {},
): Promise<AuditEventsResponse> {
  const query = new URLSearchParams();

  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.entityId) query.set('entityId', params.entityId);
  if (params.action) query.set('action', params.action);
  if (params.userId) query.set('userId', params.userId);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);

  const queryString = query.toString();
  const endpoint = queryString ? `audit-events?${queryString}` : 'audit-events';

  const res = await apiClient<{
    data?: AuditEvent[];
    items?: AuditEvent[];
    total?: number;
    totalItems?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  }>(endpoint);

  const eventList = res.data || res.items || [];
  const total = res.total ?? res.totalItems ?? eventList.length;
  const page = res.page ?? params.page ?? 1;
  const limit = res.limit ?? params.limit ?? 20;
  const totalPages = res.totalPages ?? Math.ceil(total / (limit || 1)) ?? 1;

  return {
    data: eventList,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

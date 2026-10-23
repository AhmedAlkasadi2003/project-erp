import { apiClient } from '../client';
import {
  AccountingPeriod,
  CloseAccountingPeriodDto,
  CreateAccountingPeriodDto,
  PeriodsResponse,
} from './types';

export async function getAccountingPeriods(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PeriodsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);

  const qs = query.toString();
  const endpoint = qs ? `accounting-periods?${qs}` : 'accounting-periods';
  const res = await apiClient<{
    items?: AccountingPeriod[];
    data?: AccountingPeriod[];
    meta: { page: number; limit: number; totalPages: number; totalItems: number };
  }>(endpoint);

  const periodList = res.data || res.items || [];
  return {
    data: periodList,
    items: periodList,
    meta: res.meta,
  };
}

export async function createAccountingPeriod(
  data: CreateAccountingPeriodDto,
): Promise<AccountingPeriod> {
  return apiClient<AccountingPeriod>('accounting-periods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closeAccountingPeriod(
  id: string,
  data?: CloseAccountingPeriodDto,
): Promise<AccountingPeriod> {
  return apiClient<AccountingPeriod>(`accounting-periods/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

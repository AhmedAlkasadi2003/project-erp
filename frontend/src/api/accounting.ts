import { apiClient } from './client';
import {
  Account,
  AccountingPeriod,
  AccountNormalBalance,
  AccountType,
  InventoryAccountsConfig,
  InventoryGlReconciliationResult,
  PaginatedResponse,
  PaginationMeta,
  TrialBalanceResult,
} from '../types';

export interface QueryAccountsParams {
  search?: string;
  type?: AccountType;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
  description?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export async function getAccounts(
  params?: QueryAccountsParams,
): Promise<PaginatedResponse<Account>> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.type) query.set('type', params.type);
  if (typeof params?.isActive === 'boolean') query.set('isActive', String(params.isActive));
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const raw = await apiClient<{ items?: Account[]; data?: Account[]; meta: PaginationMeta }>(
    qs ? `accounts?${qs}` : 'accounts',
  );
  const items = raw.items || raw.data || [];
  return {
    data: items,
    meta: raw.meta,
  };
}

export async function createAccount(data: CreateAccountInput): Promise<Account> {
  return apiClient<Account>('accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAccount(id: string, data: UpdateAccountInput): Promise<Account> {
  return apiClient<Account>(`accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAccount(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`accounts/${id}`, {
    method: 'DELETE',
  });
}

export async function getInventoryAccountsConfig(): Promise<InventoryAccountsConfig> {
  return apiClient<InventoryAccountsConfig>('accounting/inventory-accounts');
}

export async function updateInventoryAccountsConfig(
  grnClearingAccountId: string,
): Promise<{ message: string; config: InventoryAccountsConfig }> {
  return apiClient<{ message: string; config: InventoryAccountsConfig }>(
    'accounting/inventory-accounts',
    {
      method: 'PATCH',
      body: JSON.stringify({ grnClearingAccountId }),
    },
  );
}

export interface QueryPeriodsParams {
  search?: string;
  status?: 'OPEN' | 'CLOSED';
  page?: number;
  limit?: number;
}

export interface CreatePeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: 'OPEN' | 'CLOSED';
}

export async function getAccountingPeriods(
  params?: QueryPeriodsParams,
): Promise<PaginatedResponse<AccountingPeriod>> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const raw = await apiClient<{
    items?: AccountingPeriod[];
    data?: AccountingPeriod[];
    meta: PaginationMeta;
  }>(qs ? `accounting-periods?${qs}` : 'accounting-periods');
  const items = raw.items || raw.data || [];
  return {
    data: items,
    meta: raw.meta,
  };
}

export async function createAccountingPeriod(
  data: CreatePeriodInput,
): Promise<AccountingPeriod> {
  return apiClient<AccountingPeriod>('accounting-periods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closeAccountingPeriod(id: string): Promise<AccountingPeriod> {
  return apiClient<AccountingPeriod>(`accounting-periods/${id}/close`, {
    method: 'POST',
  });
}

export async function getTrialBalance(params?: {
  asOfDate?: string;
  periodId?: string;
}): Promise<TrialBalanceResult> {
  const query = new URLSearchParams();
  if (params?.asOfDate) query.set('asOfDate', params.asOfDate);
  if (params?.periodId) query.set('periodId', params.periodId);

  const qs = query.toString();
  return apiClient<TrialBalanceResult>(
    qs ? `accounting/reports/trial-balance?${qs}` : 'accounting/reports/trial-balance',
  );
}

export async function getGlSubledgerReconciliation(): Promise<InventoryGlReconciliationResult> {
  return apiClient<InventoryGlReconciliationResult>(
    'accounting/reports/gl-subledger-reconciliation',
  );
}

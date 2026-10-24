import { apiClient } from '../client';
import {
  Account,
  AccountsResponse,
  CreateAccountDto,
  InventoryAccountsConfig,
  UpdateAccountDto,
  UpdateInventoryAccountsConfigDto,
} from './types';

export async function getAccounts(params?: {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
}): Promise<AccountsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.type) query.set('type', params.type);
  if (params?.search) query.set('search', params.search);

  const qs = query.toString();
  const endpoint = qs ? `accounts?${qs}` : 'accounts';
  const res = await apiClient<{
    items?: Account[];
    data?: Account[];
    meta: { page: number; limit: number; totalPages: number; totalItems: number };
  }>(endpoint);

  const accountList = res.data || res.items || [];
  return {
    data: accountList,
    items: accountList,
    meta: res.meta,
  };
}

export async function createAccount(data: CreateAccountDto): Promise<Account> {
  return apiClient<Account>('accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAccount(id: string, data: UpdateAccountDto): Promise<Account> {
  return apiClient<Account>(`accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAccount(id: string): Promise<void> {
  return apiClient<void>(`accounts/${id}`, {
    method: 'DELETE',
  });
}

export async function getInventoryAccountsConfig(): Promise<InventoryAccountsConfig> {
  return apiClient<InventoryAccountsConfig>('accounting/inventory-accounts');
}

export async function updateInventoryAccountsConfig(
  data: UpdateInventoryAccountsConfigDto | string,
): Promise<InventoryAccountsConfig> {
  const payload = typeof data === 'string' ? { grnClearingAccountId: data } : data;
  return apiClient<InventoryAccountsConfig>('accounting/inventory-accounts', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

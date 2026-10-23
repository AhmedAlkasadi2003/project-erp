export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountNormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; code: string; name: string } | null;
  isActive: boolean;
  isSystem: boolean;
  _count?: { children: number; journalLines: number };
}

export interface InventoryAccountsConfig {
  companyId: string;
  companyCode: string;
  companyName: string;
  grnClearingAccountId: string | null;
  grnClearingAccount: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    normalBalance: AccountNormalBalance;
    isActive: boolean;
  } | null;
}

export interface CreateAccountDto {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
  description?: string;
  parentId?: string;
}

export interface UpdateAccountDto {
  name?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface UpdateInventoryAccountsConfigDto {
  grnClearingAccountId: string;
}

export interface AccountsResponse {
  data: Account[];
  items?: Account[];
  meta: {
    page: number;
    limit: number;
    totalPages: number;
    total?: number;
    totalItems?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

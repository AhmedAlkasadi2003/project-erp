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

export interface AccountingPeriod {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string | null;
  closedByUserId?: string | null;
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

export interface TrialBalanceAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: string;
  credit: string;
  balance: string;
  normalBalance: AccountNormalBalance;
}

export interface TrialBalanceResult {
  asOfDate: string;
  periodId: string | null;
  accounts: TrialBalanceAccountRow[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}

export interface InventoryGlReconciliationResult {
  asOfDate: string;
  subledgerTotalValue: string;
  glInventoryAssetTotal: string;
  delta: string;
  isReconciled: boolean;
  assetAccounts: Array<{
    accountId: string;
    code: string;
    name: string;
    balance: string;
  }>;
}

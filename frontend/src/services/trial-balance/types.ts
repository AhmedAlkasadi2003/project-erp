import type { AccountNormalBalance, AccountType } from '../chart-of-accounts/types';

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
  subledgerReconciliation?: {
    inventoryAssetGlBalance: string;
    inventorySubledgerTotal: string;
    grnClearingGlBalance: string;
    difference: string;
    isReconciled: boolean;
  };
}

export interface InventoryGlReconciliationResult {
  asOfDate: string;
  inventoryAssetGlBalance?: string;
  glInventoryAssetTotal?: string;
  inventorySubledgerTotal?: string;
  subledgerTotalValue?: string;
  grnClearingGlBalance?: string;
  difference?: string;
  delta?: string;
  isReconciled: boolean;
  assetAccounts?: unknown[];
}

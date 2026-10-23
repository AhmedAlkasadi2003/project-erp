import { apiClient } from '../client';
import { InventoryGlReconciliationResult, TrialBalanceResult } from './types';

export async function getTrialBalance(params?: {
  asOfDate?: string;
  periodId?: string;
}): Promise<TrialBalanceResult> {
  const query = new URLSearchParams();
  if (params?.asOfDate) query.set('asOfDate', params.asOfDate);
  if (params?.periodId) query.set('periodId', params.periodId);

  const qs = query.toString();
  const endpoint = qs
    ? `accounting/reports/trial-balance?${qs}`
    : 'accounting/reports/trial-balance';
  return apiClient<TrialBalanceResult>(endpoint);
}

export async function getGlSubledgerReconciliation(
  asOfDate?: string,
): Promise<InventoryGlReconciliationResult> {
  const query = new URLSearchParams();
  if (asOfDate) query.set('asOfDate', asOfDate);

  const qs = query.toString();
  const endpoint = qs
    ? `accounting/reports/gl-subledger-reconciliation?${qs}`
    : 'accounting/reports/gl-subledger-reconciliation';
  return apiClient<InventoryGlReconciliationResult>(endpoint);
}

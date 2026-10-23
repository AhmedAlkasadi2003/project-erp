import { Translations } from './i18n';
import { UserRole } from '../services/auth/types';

export type AppView =
  | 'receipts'
  | 'create-receipt'
  | 'edit-receipt'
  | 'receipt-details'
  | 'stock-card'
  | 'chart-of-accounts'
  | 'accounting-periods'
  | 'trial-balance'
  | 'audit-trail';

export interface NavItemConfig {
  id: AppView;
  labelKey: keyof Translations['nav'];
  allowedRoles: UserRole[];
  category?: 'inventory' | 'finance' | 'system';
}

import { AppView, NavItemConfig, UserRole } from '../types';

/**
 * Authoritative Navigation Matrix
 * Defines visibility and role requirements for every screen in the system.
 */
export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: 'receipts',
    labelKey: 'receipts',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK', 'VIEWER'],
    category: 'inventory',
  },
  {
    id: 'create-receipt',
    labelKey: 'newReceipt',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK'],
    category: 'inventory',
  },
  {
    id: 'stock-card',
    labelKey: 'stockCard',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK', 'VIEWER'],
    category: 'inventory',
  },
  {
    id: 'chart-of-accounts',
    labelKey: 'chartOfAccounts',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'accounting-periods',
    labelKey: 'accountingPeriods',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'trial-balance',
    labelKey: 'trialBalance',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'audit-trail',
    labelKey: 'auditTrail',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER'], // Hidden for Clerk
    category: 'system',
  },
];

/**
 * Evaluates whether a given user role is permitted to access a specific AppView.
 */
export function canUserAccessView(role: UserRole | undefined, view: AppView): boolean {
  if (!role) return false;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;

  // Sub-views
  if (view === 'edit-receipt') {
    return ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK'].includes(role);
  }
  if (view === 'receipt-details') {
    return true;
  }

  const item = NAVIGATION_ITEMS.find((nav) => nav.id === view);
  if (!item) return false;

  return item.allowedRoles.includes(role);
}

/**
 * Filters navigation items to only those authorized for the user's role.
 */
export function getAuthorizedNavItems(role: UserRole | undefined): NavItemConfig[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((item) => canUserAccessView(role, item.id));
}

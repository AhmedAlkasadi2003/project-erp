import { AppView, NavItemConfig, UserRole } from '../types';

export const ROUTES = {
  HOME: '/',
  RECEIPTS: '/receipts',
  CREATE_RECEIPT: '/receipts/new',
  RECEIPT_DETAILS: '/receipts/:id',
  EDIT_RECEIPT: '/receipts/:id/edit',
  STOCK_CARD: '/stock-card',
  CHART_OF_ACCOUNTS: '/chart-of-accounts',
  ACCOUNTING_PERIODS: '/accounting-periods',
  TRIAL_BALANCE: '/trial-balance',
  AUDIT_TRAIL: '/audit-trail',
  LOGIN: '/login',
} as const;

export const VIEW_PATHS: Record<AppView, string> = {
  receipts: ROUTES.RECEIPTS,
  'create-receipt': ROUTES.CREATE_RECEIPT,
  'stock-card': ROUTES.STOCK_CARD,
  'chart-of-accounts': ROUTES.CHART_OF_ACCOUNTS,
  'accounting-periods': ROUTES.ACCOUNTING_PERIODS,
  'trial-balance': ROUTES.TRIAL_BALANCE,
  'audit-trail': ROUTES.AUDIT_TRAIL,
  'receipt-details': ROUTES.RECEIPT_DETAILS,
  'edit-receipt': ROUTES.EDIT_RECEIPT,
};

/**
 * Authoritative Navigation Matrix
 * Defines visibility, route paths, and role requirements for every screen in the system.
 */
export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: 'receipts',
    path: ROUTES.RECEIPTS,
    labelKey: 'receipts',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK', 'VIEWER'],
    category: 'inventory',
  },
  {
    id: 'create-receipt',
    path: ROUTES.CREATE_RECEIPT,
    labelKey: 'newReceipt',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK'],
    category: 'inventory',
  },
  {
    id: 'stock-card',
    path: ROUTES.STOCK_CARD,
    labelKey: 'stockCard',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK', 'VIEWER'],
    category: 'inventory',
  },
  {
    id: 'chart-of-accounts',
    path: ROUTES.CHART_OF_ACCOUNTS,
    labelKey: 'chartOfAccounts',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'accounting-periods',
    path: ROUTES.ACCOUNTING_PERIODS,
    labelKey: 'accountingPeriods',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'trial-balance',
    path: ROUTES.TRIAL_BALANCE,
    labelKey: 'trialBalance',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'audit-trail',
    path: ROUTES.AUDIT_TRAIL,
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

/**
 * Resolves the destination URL path for a specific view and optional parameters.
 */
export function getPathForView(view: AppView, params?: { id?: string }): string {
  if (view === 'receipt-details' && params?.id) return `/receipts/${params.id}`;
  if (view === 'edit-receipt' && params?.id) return `/receipts/${params.id}/edit`;
  return VIEW_PATHS[view] || ROUTES.RECEIPTS;
}

/**
 * Extracts the corresponding AppView from a given URL pathname.
 */
export function getViewFromPath(pathname: string): AppView {
  if (pathname === ROUTES.CREATE_RECEIPT) return 'create-receipt';
  if (pathname.match(/^\/receipts\/[^/]+\/edit$/)) return 'edit-receipt';
  if (pathname.match(/^\/receipts\/[^/]+$/)) return 'receipt-details';
  if (pathname.startsWith('/receipts')) return 'receipts';
  if (pathname.startsWith('/stock-card')) return 'stock-card';
  if (pathname.startsWith('/chart-of-accounts')) return 'chart-of-accounts';
  if (pathname.startsWith('/accounting-periods')) return 'accounting-periods';
  if (pathname.startsWith('/trial-balance')) return 'trial-balance';
  if (pathname.startsWith('/audit-trail')) return 'audit-trail';
  return 'receipts';
}

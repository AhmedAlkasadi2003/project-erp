import { AppView, NavItemConfig, UserRole } from '../types';

export const VIEW_PATHS: Record<AppView, string> = {
  receipts: '/receipts',
  'create-receipt': '/receipts/new',
  'stock-card': '/stock-card',
  'chart-of-accounts': '/chart-of-accounts',
  'accounting-periods': '/accounting-periods',
  'trial-balance': '/trial-balance',
  'audit-trail': '/audit-trail',
  'receipt-details': '/receipts/:id',
  'edit-receipt': '/receipts/:id/edit',
};

/**
 * Authoritative Navigation Matrix
 * Defines visibility, route paths, and role requirements for every screen in the system.
 */
export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: 'receipts',
    path: '/receipts',
    labelKey: 'receipts',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK', 'VIEWER'],
    category: 'inventory',
  },
  {
    id: 'create-receipt',
    path: '/receipts/new',
    labelKey: 'newReceipt',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK'],
    category: 'inventory',
  },
  {
    id: 'stock-card',
    path: '/stock-card',
    labelKey: 'stockCard',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CLERK', 'VIEWER'],
    category: 'inventory',
  },
  {
    id: 'chart-of-accounts',
    path: '/chart-of-accounts',
    labelKey: 'chartOfAccounts',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'accounting-periods',
    path: '/accounting-periods',
    labelKey: 'accountingPeriods',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'trial-balance',
    path: '/trial-balance',
    labelKey: 'trialBalance',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], // Hidden for Clerk & Warehouse Manager
    category: 'finance',
  },
  {
    id: 'audit-trail',
    path: '/audit-trail',
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
  return VIEW_PATHS[view] || '/receipts';
}

/**
 * Extracts the corresponding AppView from a given URL pathname.
 */
export function getViewFromPath(pathname: string): AppView {
  if (pathname === '/receipts/new') return 'create-receipt';
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

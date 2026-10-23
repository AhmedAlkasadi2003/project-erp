import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LocaleProvider } from '../context/LocaleContext';
import { AuthProvider } from '../context/AuthContext';
import { StockCardView } from '../components/inventory/StockCardView';
import { ChartOfAccountsView } from '../components/accounting/ChartOfAccountsView';
import { AccountingPeriodsView } from '../components/accounting/AccountingPeriodsView';
import { TrialBalanceView } from '../components/accounting/TrialBalanceView';
import { AuditTrailView } from '../components/audit/AuditTrailView';
import * as inventoryApi from '../api/inventory';
import * as referencesApi from '../api/references';
import * as accountingApi from '../api/accounting';
import * as authApi from '../api/auth';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <LocaleProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LocaleProvider>,
  );
};

describe('Enterprise Views & Role Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('erp_token', 'mock-token');

    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      id: 'usr-admin',
      companyId: 'comp-1',
      email: 'admin@acme.local',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });

    vi.spyOn(authApi, 'getCurrentCompany').mockResolvedValue({
      id: 'comp-1',
      code: 'COMP-01',
      name: 'Acme Corp',
      currency: 'USD',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
  });

  describe('StockCardView', () => {
    it('loads items and renders stock card movement history and balances', async () => {
      vi.spyOn(referencesApi, 'getCompanyItems').mockResolvedValue([
        {
          id: 'item-1',
          companyId: 'comp-1',
          sku: 'SKU-STEEL-10',
          name: 'Steel Sheet 10mm',
          uom: 'PCS',
          valuationMethod: 'WEIGHTED_AVERAGE',
          isActive: true,
        },
      ]);
      vi.spyOn(referencesApi, 'getCompanyWarehouses').mockResolvedValue([]);

      vi.spyOn(inventoryApi, 'getItemStockCard').mockResolvedValue({
        item: {
          id: 'item-1',
          sku: 'SKU-STEEL-10',
          name: 'Steel Sheet 10mm',
          uom: 'PCS',
          valuationMethod: 'WEIGHTED_AVERAGE',
        },
        period: {},
        openingBalance: { quantity: '0.0000', averageCost: '0.0000', totalValue: '0.0000' },
        movements: [
          {
            id: 'mov-1',
            movementDate: '2026-10-22T10:00:00.000Z',
            createdAt: '2026-10-22T10:00:00.000Z',
            movementType: 'INBOUND',
            referenceType: 'RECEIPT',
            referenceId: 'rec-001',
            quantity: '50.0000',
            unitCost: '20.0000',
            totalCost: '1000.0000',
            runningQuantity: '50.0000',
            runningAverageCost: '20.0000',
            performedBy: { id: 'u1', email: 'admin@acme.local', name: 'Admin' },
          },
        ],
        closingBalance: { quantity: '50.0000', averageCost: '20.0000', totalValue: '1000.0000' },
        currentBalances: [],
        pagination: { page: 1, limit: 50, totalPages: 1, totalItems: 1 },
      });

      renderWithProviders(<StockCardView />);

      await waitFor(() => {
        expect(screen.getByText(/Item Stock Card/i)).toBeInTheDocument();
        expect(screen.getAllByText(/SKU-STEEL-10/i).length).toBeGreaterThan(0);
        expect(screen.getByText('INBOUND')).toBeInTheDocument();
      });
    });
  });

  describe('ChartOfAccountsView', () => {
    it('renders list of accounts and GRN clearing badge', async () => {
      vi.spyOn(accountingApi, 'getAccounts').mockResolvedValue({
        data: [
          {
            id: 'acc-1',
            companyId: 'comp-1',
            code: '2110',
            name: 'GRN Clearing Account',
            type: 'LIABILITY',
            normalBalance: 'CREDIT',
            isActive: true,
            isSystem: true,
          },
        ],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });

      vi.spyOn(accountingApi, 'getInventoryAccountsConfig').mockResolvedValue({
        companyId: 'comp-1',
        companyCode: 'COMP-01',
        companyName: 'Acme Corp',
        grnClearingAccountId: 'acc-1',
        grnClearingAccount: {
          id: 'acc-1',
          code: '2110',
          name: 'GRN Clearing Account',
          type: 'LIABILITY',
          normalBalance: 'CREDIT',
          isActive: true,
        },
      });

      renderWithProviders(<ChartOfAccountsView />);

      await waitFor(() => {
        expect(screen.getByText(/Chart of Accounts/i)).toBeInTheDocument();
        expect(screen.getByText('2110')).toBeInTheDocument();
        expect(screen.getAllByText(/GRN Clearing/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('AccountingPeriodsView', () => {
    it('renders periods list and status', async () => {
      vi.spyOn(accountingApi, 'getAccountingPeriods').mockResolvedValue({
        data: [
          {
            id: 'per-1',
            companyId: 'comp-1',
            name: 'October 2026',
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-10-31T23:59:59.999Z',
            status: 'OPEN',
          },
        ],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });

      renderWithProviders(<AccountingPeriodsView />);

      await waitFor(() => {
        expect(screen.getByText(/Accounting Periods Management/i)).toBeInTheDocument();
        expect(screen.getByText('October 2026')).toBeInTheDocument();
      });
    });
  });

  describe('TrialBalanceView & AuditTrailView Permissions', () => {
    it('renders trial balance and reconciliation when user is Accountant or Admin', async () => {
      vi.spyOn(accountingApi, 'getTrialBalance').mockResolvedValue({
        asOfDate: '2026-10-22',
        periodId: null,
        accounts: [
          {
            accountId: 'acc-1',
            code: '1310',
            name: 'Inventory Asset',
            type: 'ASSET',
            debit: '1000.0000',
            credit: '0.0000',
            balance: '1000.0000',
            normalBalance: 'DEBIT',
          },
          {
            accountId: 'acc-2',
            code: '2110',
            name: 'GRN Clearing',
            type: 'LIABILITY',
            debit: '0.0000',
            credit: '1000.0000',
            balance: '1000.0000',
            normalBalance: 'CREDIT',
          },
        ],
        totalDebit: '1000.0000',
        totalCredit: '1000.0000',
        isBalanced: true,
      });

      vi.spyOn(accountingApi, 'getGlSubledgerReconciliation').mockResolvedValue({
        asOfDate: '2026-10-22',
        subledgerTotalValue: '1000.0000',
        glInventoryAssetTotal: '1000.0000',
        delta: '0.0000',
        isReconciled: true,
        assetAccounts: [],
      });

      renderWithProviders(<TrialBalanceView />);

      await waitFor(() => {
        expect(screen.getByText(/Trial Balance & Financial Reconciliation/i)).toBeInTheDocument();
        expect(screen.getByText(/100% Reconciled/i)).toBeInTheDocument();
      });
    });

    it('blocks clerk from viewing Trial Balance', async () => {
      vi.spyOn(authApi, 'getMe').mockResolvedValue({
        id: 'usr-clerk',
        companyId: 'comp-1',
        email: 'clerk@acme.local',
        firstName: 'Clerk',
        lastName: 'User',
        role: 'CLERK',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });

      renderWithProviders(<TrialBalanceView />);

      await waitFor(() => {
        expect(screen.getByText(/صلاحيات غير كافية/i)).toBeInTheDocument();
      });
    });

    it('blocks clerk from viewing Audit Trail', async () => {
      vi.spyOn(authApi, 'getMe').mockResolvedValue({
        id: 'usr-clerk',
        companyId: 'comp-1',
        email: 'clerk@acme.local',
        firstName: 'Clerk',
        lastName: 'User',
        role: 'CLERK',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });

      renderWithProviders(<AuditTrailView />);

      await waitFor(() => {
        expect(screen.getByText(/صلاحيات غير كافية/i)).toBeInTheDocument();
      });
    });
  });
});

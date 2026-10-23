import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FormField } from '../components/FormField';
import { ReceiptForm } from '../features/receipts/ReceiptForm';
import { ReceiptList } from '../features/receipts/ReceiptList';
import { AuthProvider } from '../hooks/useAuth';
import { LocaleProvider } from '../hooks/useLocale';
import * as receiptsApi from '../services/receipts';
import * as referencesApi from '../services/references';
import * as authApi from '../services/auth';
import { ApiError } from '../services/client';

vi.mock('../services/receipts');
vi.mock('../services/references');
vi.mock('../services/auth');

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <LocaleProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LocaleProvider>,
  );
}

describe('Form & URL Enhancements (Assignment Criteria)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('erp_token', 'mock-jwt-token');
    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      id: 'usr-1',
      companyId: 'comp-1',
      email: 'admin@acme.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
  });

  describe('FormField Component Abstraction', () => {
    it('renders label with required indicator class and help text', () => {
      render(
        <FormField
          label="Warehouse Location"
          htmlFor="test-input"
          required
          helpText="Select primary bay"
        >
          <input id="test-input" type="text" />
        </FormField>,
      );

      const labelEl = screen.getByText('Warehouse Location');
      expect(labelEl).toBeInTheDocument();
      expect(labelEl).toHaveClass('form-label-required');
      expect(screen.getByText('Select primary bay')).toBeInTheDocument();
    });

    it('renders error message with alert role when error is present', () => {
      render(
        <FormField label="Item SKU" htmlFor="sku-input" error="SKU is required">
          <input id="sku-input" type="text" />
        </FormField>,
      );

      const errorEl = screen.getByRole('alert');
      expect(errorEl).toHaveTextContent('SKU is required');
    });
  });

  describe('ReceiptForm Conflict (409) Handling', () => {
    it('displays conflict message when server responds with 409 Conflict', async () => {
      vi.spyOn(referencesApi, 'getCompanyWarehouses').mockResolvedValue([
        { id: 'wh-1', companyId: 'comp-1', code: 'WH-01', name: 'Main', isActive: true },
      ]);
      vi.spyOn(referencesApi, 'getCompanySuppliers').mockResolvedValue([
        { id: 'sup-1', companyId: 'comp-1', code: 'SUP-01', name: 'Acme', isActive: true },
      ]);
      vi.spyOn(referencesApi, 'getCompanyItems').mockResolvedValue([
        {
          id: 'item-1',
          companyId: 'comp-1',
          sku: 'SKU-01',
          name: 'Steel',
          uom: 'PCS',
          valuationMethod: 'WEIGHTED_AVERAGE',
          isActive: true,
        },
      ]);

      vi.spyOn(receiptsApi, 'createReceipt').mockRejectedValue(
        new ApiError(409, 'Conflict', 'Receipt version conflict detected'),
      );

      renderWithProviders(<ReceiptForm onSaved={vi.fn()} onCancel={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/SKU-01 — Steel/i)).toBeInTheDocument();
      });

      const form = document.getElementById('receipt-draft-form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/This receipt was modified by another user/i)).toBeInTheDocument();
      });
    });
  });

  describe('ReceiptList URL Search Params Sync', () => {
    it('initializes from and updates browser URL search params', async () => {
      vi.spyOn(referencesApi, 'getCompanyWarehouses').mockResolvedValue([]);
      vi.spyOn(referencesApi, 'getCompanySuppliers').mockResolvedValue([]);
      vi.spyOn(receiptsApi, 'getReceipts').mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      renderWithProviders(
        <ReceiptList onSelectReceipt={vi.fn()} onEditReceipt={vi.fn()} onCreateNew={vi.fn()} />,
      );

      await waitFor(() => {
        expect(receiptsApi.getReceipts).toHaveBeenCalled();
      });

      // Filter search
      const searchInput = screen.getByPlaceholderText(/Search by receipt/i);
      fireEvent.change(searchInput, { target: { value: 'REC-999' } });

      fireEvent.click(screen.getByRole('button', { name: /^Filter$/i }));

      await waitFor(() => {
        expect(window.location.search).toContain('search=REC-999');
      });
    });
  });
});

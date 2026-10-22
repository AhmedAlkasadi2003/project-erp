import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReceiptList } from '../components/receipts/ReceiptList';
import { ReceiptForm } from '../components/receipts/ReceiptForm';
import { ReceiptDetails } from '../components/receipts/ReceiptDetails';
import { PostReceiptModal } from '../components/receipts/PostReceiptModal';
import { VoidReceiptModal } from '../components/receipts/VoidReceiptModal';
import { AuthProvider } from '../context/AuthContext';
import { LocaleProvider } from '../context/LocaleContext';
import * as receiptsApi from '../api/receipts';
import * as referencesApi from '../api/references';
import * as authApi from '../api/auth';
import { Receipt } from '../types';

vi.mock('../api/receipts');
vi.mock('../api/references');
vi.mock('../api/auth');

const mockReceipt: Receipt = {
  id: 'rec-1',
  companyId: 'comp-1',
  warehouseId: 'wh-1',
  supplierId: 'sup-1',
  receiptNumber: 'REC-2026-001',
  status: 'DRAFT',
  receiptDate: '2026-10-22',
  notes: 'Shipment batch 1',
  subtotal: '150.0000',
  taxAmount: '0.0000',
  totalAmount: '150.0000',
  version: 1,
  createdAt: '2026-10-22T10:00:00.000Z',
  updatedAt: '2026-10-22T10:00:00.000Z',
  lines: [
    {
      id: 'line-1',
      receiptId: 'rec-1',
      lineNumber: 1,
      itemId: 'item-1',
      quantityReceived: '10.0000',
      unitCost: '15.0000',
      taxAmount: '0.0000',
      totalAmount: '150.0000',
      notes: null,
      createdAt: '2026-10-22T10:00:00.000Z',
      updatedAt: '2026-10-22T10:00:00.000Z',
      item: {
        id: 'item-1',
        companyId: 'comp-1',
        sku: 'SKU-STEEL-01',
        name: 'Steel Sheet 2mm',
        uom: 'PCS',
        valuationMethod: 'WEIGHTED_AVERAGE',
        isActive: true,
      },
    },
  ],
  warehouse: {
    id: 'wh-1',
    companyId: 'comp-1',
    code: 'WH-MAIN',
    name: 'Main Central Warehouse',
    isActive: true,
  },
  supplier: {
    id: 'sup-1',
    companyId: 'comp-1',
    code: 'SUP-ACME',
    name: 'Acme Metal Supply Ltd',
    isActive: true,
  },
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <LocaleProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LocaleProvider>,
  );
};

describe('Receipt Workflows & Components', () => {
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
    vi.spyOn(referencesApi, 'getCompanyWarehouses').mockResolvedValue([
      { id: 'wh-1', companyId: 'comp-1', code: 'WH-01', name: 'Main Warehouse', isActive: true },
    ]);
    vi.spyOn(referencesApi, 'getCompanySuppliers').mockResolvedValue([
      { id: 'sup-1', companyId: 'comp-1', code: 'SUP-01', name: 'Apex Supplies', isActive: true },
    ]);
    vi.spyOn(referencesApi, 'getCompanyItems').mockResolvedValue([
      {
        id: 'item-1',
        companyId: 'comp-1',
        sku: 'SKU-001',
        name: 'Copper Wire',
        uom: 'M',
        valuationMethod: 'WEIGHTED_AVERAGE',
        isActive: true,
      },
    ]);
  });

  describe('ReceiptList', () => {
    it('renders list of receipts and status badges', async () => {
      vi.spyOn(receiptsApi, 'getReceipts').mockResolvedValue({
        data: [mockReceipt],
        meta: {
          total: 1,
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
        expect(screen.getByText('REC-2026-001')).toBeInTheDocument();
        expect(screen.getByRole('status', { name: /Status: Draft/i })).toBeInTheDocument();
      });
    });

    it('renders empty state when no receipts are found', async () => {
      vi.spyOn(receiptsApi, 'getReceipts').mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      renderWithProviders(
        <ReceiptList onSelectReceipt={vi.fn()} onEditReceipt={vi.fn()} onCreateNew={vi.fn()} />,
      );

      await waitFor(() => {
        expect(screen.getByText(/No receipts match your search criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('ReceiptForm (Create & Edit)', () => {
    it('validates and adds dynamic receipt lines', async () => {
      renderWithProviders(<ReceiptForm onSaved={vi.fn()} onCancel={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/SKU-001 — Copper Wire/i)).toBeInTheDocument();
      });

      // Add a second line
      fireEvent.click(screen.getByText(/\+ Add Line Item/i));

      await waitFor(() => {
        const removeButtons = screen.getAllByTitle(/Remove/i);
        expect(removeButtons).toHaveLength(2);
      });
    });

    it('submits valid draft creation through receiptsApi', async () => {
      const onSavedMock = vi.fn();
      vi.spyOn(receiptsApi, 'createReceipt').mockResolvedValue(mockReceipt);

      renderWithProviders(<ReceiptForm onSaved={onSavedMock} onCancel={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/SKU-001 — Copper Wire/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Receipt #/i), {
        target: { value: 'REC-NEW-001' },
      });

      const form = document.getElementById('receipt-draft-form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(receiptsApi.createReceipt).toHaveBeenCalled();
        expect(onSavedMock).toHaveBeenCalledWith(mockReceipt);
      });
    });
  });

  describe('ReceiptDetails', () => {
    it('renders complete receipt details and action buttons for DRAFT status', async () => {
      vi.spyOn(receiptsApi, 'getReceiptById').mockResolvedValue(mockReceipt);

      renderWithProviders(
        <ReceiptDetails
          receiptId="rec-1"
          onBack={vi.fn()}
          onEdit={vi.fn()}
          onReceiptDeleted={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText('REC-2026-001').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Post to GL/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
      });
    });

    it('renders Void button for POSTED receipts and hides edit/delete', async () => {
      const postedReceipt: Receipt = {
        ...mockReceipt,
        status: 'POSTED',
        postingDate: '2026-10-22',
        journalEntryId: 'je-uuid-1',
      };
      vi.spyOn(receiptsApi, 'getReceiptById').mockResolvedValue(postedReceipt);

      renderWithProviders(
        <ReceiptDetails
          receiptId="rec-1"
          onBack={vi.fn()}
          onEdit={vi.fn()}
          onReceiptDeleted={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText('REC-2026-001').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Void Receipt/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Post to GL/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('PostReceiptModal', () => {
    it('displays debit and credit impact preview and posts with confirmation', async () => {
      const onSuccessMock = vi.fn();
      vi.spyOn(receiptsApi, 'postReceipt').mockResolvedValue({
        ...mockReceipt,
        status: 'POSTED',
      });

      renderWithProviders(
        <PostReceiptModal
          receipt={mockReceipt}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccessMock}
          onError={vi.fn()}
        />,
      );

      expect(screen.getByText(/Confirm Inventory Receipt Posting/i)).toBeInTheDocument();
      expect(screen.getByText(/Debit: Inventory Asset Account/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Credit: Accrued Goods Received Clearing Account/i),
      ).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /Confirm & Post to Ledger/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(receiptsApi.postReceipt).toHaveBeenCalledWith('rec-1', expect.any(String));
        expect(onSuccessMock).toHaveBeenCalled();
      });
    });
  });

  describe('VoidReceiptModal', () => {
    it('requires voidReason before executing safe void', async () => {
      const onSuccessMock = vi.fn();
      const postedReceipt: Receipt = { ...mockReceipt, status: 'POSTED' };

      renderWithProviders(
        <VoidReceiptModal
          receipt={postedReceipt}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccessMock}
          onError={vi.fn()}
        />,
      );

      const confirmButton = screen.getByRole('button', { name: /Execute Safe Void/i });
      fireEvent.click(confirmButton);

      expect(
        screen.getByText(/A reason is required before voiding can be processed/i),
      ).toBeInTheDocument();
      expect(receiptsApi.voidReceipt).not.toHaveBeenCalled();

      // Enter reason and submit
      const reasonInput = screen.getByPlaceholderText(/Enter audit rationale for voiding/i);
      fireEvent.change(reasonInput, { target: { value: 'Supplier wrong delivery' } });

      vi.spyOn(receiptsApi, 'voidReceipt').mockResolvedValue({
        ...postedReceipt,
        status: 'VOIDED',
        voidReason: 'Supplier wrong delivery',
      });

      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(receiptsApi.voidReceipt).toHaveBeenCalledWith('rec-1', 'Supplier wrong delivery');
        expect(onSuccessMock).toHaveBeenCalled();
      });
    });
  });
});

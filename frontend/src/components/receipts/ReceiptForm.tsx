import React, { useEffect, useState, useCallback } from 'react';
import {
  CreateReceiptDto,
  CreateReceiptLineDto,
  Item,
  Receipt,
  Supplier,
  Warehouse,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { Alert } from '../common/Alert';
import { LoadingSpinner } from '../common/LoadingSpinner';
import * as receiptsApi from '../../api/receipts';
import * as referencesApi from '../../api/references';
import { ApiError } from '../../api/client';

interface ReceiptFormProps {
  receiptId?: string | null;
  onSaved: (receipt: Receipt) => void;
  onCancel: () => void;
}

interface FormLineState {
  id?: string;
  itemId: string;
  quantityReceived: string;
  unitCost: string;
  taxAmount: string;
  notes: string;
}

export const ReceiptForm: React.FC<ReceiptFormProps> = ({ receiptId, onSaved, onCancel }) => {
  const { user } = useAuth();
  const { t, formatCurrency } = useLocale();

  const isEditMode = Boolean(receiptId);

  // Reference data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Form states
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<FormLineState[]>([
    { itemId: '', quantityReceived: '1.0000', unitCost: '0.0000', taxAmount: '0.0000', notes: '' },
  ]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isNonDraftLocked, setIsNonDraftLocked] = useState<boolean>(false);

  // Client calculation preview
  const calculatePreviewTotal = useCallback(() => {
    let subtotal = 0;
    for (const l of lines) {
      const q = parseFloat(l.quantityReceived) || 0;
      const c = parseFloat(l.unitCost) || 0;
      subtotal += q * c;
    }
    return Math.round(subtotal * 10000) / 10000;
  }, [lines]);

  const loadReferences = useCallback(async () => {
    if (!user?.companyId) return;
    try {
      const [whList, supList, itemList] = await Promise.all([
        referencesApi.getCompanyWarehouses(user.companyId),
        referencesApi.getCompanySuppliers(user.companyId),
        referencesApi.getCompanyItems(user.companyId),
      ]);
      setWarehouses(whList);
      setSuppliers(supList);
      setItems(itemList);

      // Default first warehouse and supplier for quick creation
      if (!isEditMode) {
        if (whList.length > 0) setWarehouseId((prev) => prev || whList[0].id);
        if (supList.length > 0) setSupplierId((prev) => prev || supList[0].id);
        if (itemList.length > 0) {
          setLines((prev) => {
            if (prev.length === 1 && !prev[0].itemId) {
              return [
                {
                  itemId: itemList[0].id,
                  quantityReceived: '1.0000',
                  unitCost: '10.0000',
                  taxAmount: '0.0000',
                  notes: '',
                },
              ];
            }
            return prev;
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master reference data');
    }
  }, [user?.companyId, isEditMode]);

  const loadReceiptForEdit = useCallback(async () => {
    if (!receiptId) return;
    try {
      const r = await receiptsApi.getReceiptById(receiptId);
      if (r.status !== 'DRAFT') {
        setIsNonDraftLocked(true);
      }
      setWarehouseId(r.warehouseId);
      setSupplierId(r.supplierId);
      setReceiptNumber(r.receiptNumber);
      setReceiptDate(r.receiptDate ? r.receiptDate.split('T')[0] : '');
      setNotes(r.notes || '');

      if (r.lines && r.lines.length > 0) {
        setLines(
          r.lines.map((l) => ({
            id: l.id,
            itemId: l.itemId,
            quantityReceived: l.quantityReceived,
            unitCost: l.unitCost,
            taxAmount: l.taxAmount,
            notes: l.notes || '',
          })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipt details');
    }
  }, [receiptId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadReferences();
      if (isEditMode) {
        await loadReceiptForEdit();
      }
      setLoading(false);
    };
    void init();
  }, [loadReferences, loadReceiptForEdit, isEditMode]);

  const handleAddLine = () => {
    const defaultItemId = items.length > 0 ? items[0].id : '';
    setLines([
      ...lines,
      {
        itemId: defaultItemId,
        quantityReceived: '1.0000',
        unitCost: '0.0000',
        taxAmount: '0.0000',
        notes: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      setError(t.common.atLeastOneLine);
      return;
    }
    const updated = lines.filter((_, idx) => idx !== index);
    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof FormLineState, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const validateClientSide = (): boolean => {
    const errors: string[] = [];
    if (!warehouseId) errors.push(t.receipts.selectWarehouse);
    if (!supplierId) errors.push(t.receipts.selectSupplier);
    if (!receiptDate) errors.push(t.common.required + ': ' + t.receipts.date);

    if (lines.length === 0) {
      errors.push(t.common.atLeastOneLine);
    }

    lines.forEach((l, idx) => {
      if (!l.itemId) {
        errors.push(`Line ${idx + 1}: ${t.receipts.selectItem}`);
      }
      const q = parseFloat(l.quantityReceived);
      if (isNaN(q) || q <= 0) {
        errors.push(`Line ${idx + 1}: ${t.common.invalidQuantity}`);
      }
      const c = parseFloat(l.unitCost);
      if (isNaN(c) || c < 0) {
        errors.push(`Line ${idx + 1}: ${t.common.invalidCost}`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    if (!validateClientSide()) {
      return;
    }

    setSaving(true);
    try {
      const lineDtos: CreateReceiptLineDto[] = lines.map((l) => ({
        itemId: l.itemId,
        quantityReceived: l.quantityReceived,
        unitCost: l.unitCost,
        taxAmount: l.taxAmount || '0.0000',
        notes: l.notes.trim() || undefined,
      }));

      if (isEditMode && receiptId) {
        // Update Header
        await receiptsApi.updateReceiptHeader(receiptId, {
          warehouseId,
          supplierId,
          receiptNumber: receiptNumber.trim() || undefined,
          receiptDate: receiptDate || undefined,
          notes: notes.trim() || undefined,
        });

        // Reconcile / Replace lines
        const updated = await receiptsApi.replaceReceiptLines(receiptId, lineDtos);
        onSaved(updated);
      } else {
        // Create new draft
        const createDto: CreateReceiptDto = {
          warehouseId,
          supplierId,
          receiptNumber: receiptNumber.trim() || undefined,
          receiptDate: receiptDate || undefined,
          notes: notes.trim() || undefined,
          lines: lineDtos,
        };

        const created = await receiptsApi.createReceipt(createDto);
        onSaved(created);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.validationErrors && err.validationErrors.length > 0) {
          setValidationErrors(err.validationErrors);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save receipt');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t.common.loading} />;
  }

  if (isNonDraftLocked) {
    return (
      <div className="receipt-form-container">
        <Alert
          type="warning"
          message="This receipt cannot be edited because it is already POSTED or VOIDED."
        />
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t.common.back}
        </button>
      </div>
    );
  }

  const previewTotal = calculatePreviewTotal();

  return (
    <div className="receipt-form-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">
            {isEditMode ? t.receipts.editTitle : t.receipts.createTitle}
          </h2>
          <p className="view-subtitle">{t.receipts.serverAuthoritativeNote}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="receipt-draft-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {validationErrors.length > 0 && (
        <Alert
          type="error"
          message="Validation failed. Please correct the highlighted errors:"
          details={validationErrors}
          onClose={() => setValidationErrors([])}
        />
      )}

      <form id="receipt-draft-form" onSubmit={handleSubmit} className="receipt-form">
        {/* Header Information Card */}
        <div className="form-card">
          <h3 className="form-section-title">1. Document Header Information</h3>
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="warehouse-field" className="form-label form-label-required">
                {t.receipts.warehouse}
              </label>
              <select
                id="warehouse-field"
                className="form-select"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                disabled={saving}
              >
                <option value="">{t.receipts.selectWarehouse}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="supplier-field" className="form-label form-label-required">
                {t.receipts.supplier}
              </label>
              <select
                id="supplier-field"
                className="form-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                disabled={saving}
              >
                <option value="">{t.receipts.selectSupplier}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="receipt-date-field" className="form-label form-label-required">
                {t.receipts.date}
              </label>
              <input
                id="receipt-date-field"
                type="date"
                className="form-input"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="receipt-number-field" className="form-label">
                {t.receipts.receiptNumber} <small>(leave blank for auto-generation)</small>
              </label>
              <input
                id="receipt-number-field"
                type="text"
                className="form-input"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="e.g. REC-2026-001"
                disabled={saving}
              />
            </div>

            <div className="form-group grid-span-2">
              <label htmlFor="notes-field" className="form-label">
                {t.receipts.notes}
              </label>
              <input
                id="notes-field"
                type="text"
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reference delivery note, PO #, bay number..."
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Lines Information Card */}
        <div className="form-card">
          <div className="card-header-flex">
            <h3 className="form-section-title">2. {t.receipts.lines}</h3>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAddLine}
              disabled={saving}
            >
              {t.receipts.addLine}
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table lines-table" aria-label="Receipt Lines Entry Table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '40px' }}>
                    #
                  </th>
                  <th scope="col" style={{ minWidth: '220px' }}>
                    {t.receipts.item}
                  </th>
                  <th scope="col" style={{ width: '130px' }}>
                    {t.receipts.quantity}
                  </th>
                  <th scope="col" style={{ width: '130px' }}>
                    {t.receipts.unitCost}
                  </th>
                  <th scope="col" style={{ width: '130px' }} className="text-end">
                    {t.receipts.lineTotal}
                  </th>
                  <th scope="col" style={{ width: '60px' }} className="text-center">
                    ✕
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const qty = parseFloat(line.quantityReceived) || 0;
                  const cost = parseFloat(line.unitCost) || 0;
                  const linePreviewTotal = Math.round(qty * cost * 10000) / 10000;

                  return (
                    <tr key={idx}>
                      <td className="text-muted">{idx + 1}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={line.itemId}
                          onChange={(e) => handleLineChange(idx, 'itemId', e.target.value)}
                          required
                          disabled={saving}
                          aria-label={`Line ${idx + 1} item selection`}
                        >
                          <option value="">{t.receipts.selectItem}</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.sku} — {it.name} ({it.uom})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          className="form-input form-input-sm text-end"
                          value={line.quantityReceived}
                          onChange={(e) =>
                            handleLineChange(idx, 'quantityReceived', e.target.value)
                          }
                          required
                          disabled={saving}
                          aria-label={`Line ${idx + 1} quantity`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0000"
                          className="form-input form-input-sm text-end"
                          value={line.unitCost}
                          onChange={(e) => handleLineChange(idx, 'unitCost', e.target.value)}
                          required
                          disabled={saving}
                          aria-label={`Line ${idx + 1} unit cost`}
                        />
                      </td>
                      <td className="text-end font-mono">{formatCurrency(linePreviewTotal)}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length <= 1 || saving}
                          aria-label={`Remove line ${idx + 1}`}
                          title={t.receipts.removeLine}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Form Totals Summary */}
          <div className="form-totals-summary">
            <span className="totals-label">{t.receipts.totalAmount} (Client Preview):</span>
            <strong className="totals-amount">{formatCurrency(previewTotal)}</strong>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="form-footer-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </form>
    </div>
  );
};

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { FormField } from '../common/FormField';
import { translateErrorMessage } from '../../i18n/errorTranslator';
import * as receiptsApi from '../../api/receipts';
import * as referencesApi from '../../api/references';
import { ApiError } from '../../api/client';

const receiptLineSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().min(1, 'Item selection is required'),
  quantityReceived: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Quantity must be greater than 0'),
  unitCost: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, 'Unit cost cannot be negative'),
  taxAmount: z.string().optional(),
  notes: z.string().optional(),
});

const receiptFormSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse selection is required'),
  supplierId: z.string().min(1, 'Supplier selection is required'),
  receiptNumber: z.string().optional(),
  receiptDate: z.string().min(1, 'Receipt date is required'),
  notes: z.string().optional(),
  lines: z.array(receiptLineSchema).min(1, 'At least one line item is required'),
});

type ReceiptFormValues = z.infer<typeof receiptFormSchema>;

interface ReceiptFormProps {
  receiptId?: string | null;
  onSaved: (receipt: Receipt) => void;
  onCancel: () => void;
}

export const ReceiptForm: React.FC<ReceiptFormProps> = ({ receiptId, onSaved, onCancel }) => {
  const { user } = useAuth();
  const { t, locale, formatCurrency } = useLocale();

  const isEditMode = Boolean(receiptId);

  // Reference data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isNonDraftLocked, setIsNonDraftLocked] = useState<boolean>(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: {
      warehouseId: '',
      supplierId: '',
      receiptNumber: '',
      receiptDate: new Date().toISOString().split('T')[0],
      notes: '',
      lines: [
        {
          itemId: '',
          quantityReceived: '1.0000',
          unitCost: '0.0000',
          taxAmount: '0.0000',
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchedLines = watch('lines');

  // Client calculation preview using safe integer minor-units math (no IEEE floats)
  const previewTotal = useMemo(() => {
    if (!watchedLines || watchedLines.length === 0) return '0.0000';
    let totalCents = 0n; // 4 decimals -> 10000 scale
    for (const l of watchedLines) {
      if (!l) continue;
      const qStr = l.quantityReceived || '0';
      const cStr = l.unitCost || '0';

      const parseDec4 = (str: string): bigint => {
        const parts = str.split('.');
        const whole = BigInt(parts[0] || '0');
        const frac = BigInt((parts[1] || '').padEnd(4, '0').slice(0, 4));
        const sign = parts[0]?.startsWith('-') ? -1n : 1n;
        return whole * 10000n + (sign < 0n ? -frac : frac);
      };

      const q = parseDec4(qStr);
      const c = parseDec4(cStr);
      const product = q * c;
      const rounded = (product + 5000n) / 10000n;
      totalCents += rounded;
    }

    const isNeg = totalCents < 0n;
    const abs = isNeg ? -totalCents : totalCents;
    const whole = abs / 10000n;
    const frac = abs % 10000n;
    return `${isNeg ? '-' : ''}${whole}.${frac.toString().padStart(4, '0')}`;
  }, [watchedLines]);

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

      if (!isEditMode) {
        if (whList.length > 0) setValue('warehouseId', whList[0].id);
        if (supList.length > 0) setValue('supplierId', supList[0].id);
        if (itemList.length > 0) {
          setValue('lines', [
            {
              itemId: itemList[0].id,
              quantityReceived: '1.0000',
              unitCost: '10.0000',
              taxAmount: '0.0000',
              notes: '',
            },
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master reference data');
    }
  }, [user?.companyId, isEditMode, setValue]);

  const loadReceiptForEdit = useCallback(async () => {
    if (!receiptId) return;
    try {
      const r = await receiptsApi.getReceiptById(receiptId);
      if (r.status !== 'DRAFT') {
        setIsNonDraftLocked(true);
      }
      reset({
        warehouseId: r.warehouseId,
        supplierId: r.supplierId,
        receiptNumber: r.receiptNumber,
        receiptDate: r.receiptDate ? r.receiptDate.split('T')[0] : '',
        notes: r.notes || '',
        lines:
          r.lines && r.lines.length > 0
            ? r.lines.map((l) => ({
                id: l.id,
                itemId: l.itemId,
                quantityReceived: l.quantityReceived,
                unitCost: l.unitCost,
                taxAmount: l.taxAmount,
                notes: l.notes || '',
              }))
            : [
                {
                  itemId: '',
                  quantityReceived: '1.0000',
                  unitCost: '0.0000',
                  taxAmount: '0.0000',
                  notes: '',
                },
              ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipt details');
    }
  }, [receiptId, reset]);

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
    append({
      itemId: defaultItemId,
      quantityReceived: '1.0000',
      unitCost: '0.0000',
      taxAmount: '0.0000',
      notes: '',
    });
  };

  const handleRemoveLine = (index: number) => {
    if (fields.length <= 1) {
      setError(t.common.atLeastOneLine);
      return;
    }
    remove(index);
  };

  const onValidSubmit = async (data: ReceiptFormValues) => {
    setError(null);
    setValidationErrors([]);
    setSaving(true);

    try {
      const lineDtos: CreateReceiptLineDto[] = data.lines.map((l) => ({
        itemId: l.itemId,
        quantityReceived: l.quantityReceived,
        unitCost: l.unitCost,
        taxAmount: l.taxAmount || '0.0000',
        notes: l.notes?.trim() || undefined,
      }));

      if (isEditMode && receiptId) {
        // Update Header
        await receiptsApi.updateReceiptHeader(receiptId, {
          warehouseId: data.warehouseId,
          supplierId: data.supplierId,
          receiptNumber: data.receiptNumber?.trim() || undefined,
          receiptDate: data.receiptDate || undefined,
          notes: data.notes?.trim() || undefined,
        });

        // Replace Lines
        const updated = await receiptsApi.replaceReceiptLines(receiptId, lineDtos);
        onSaved(updated);
      } else {
        // Create new draft
        const createDto: CreateReceiptDto = {
          warehouseId: data.warehouseId,
          supplierId: data.supplierId,
          receiptNumber: data.receiptNumber?.trim() || undefined,
          receiptDate: data.receiptDate || undefined,
          notes: data.notes?.trim() || undefined,
          lines: lineDtos,
        };

        const created = await receiptsApi.createReceipt(createDto);
        onSaved(created);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(t.receipts.conflictError);
        } else {
          setError(translateErrorMessage(err.message, locale));
        }
        if (err.validationErrors && err.validationErrors.length > 0) {
          setValidationErrors(
            err.validationErrors.map((e) => translateErrorMessage(e, locale)),
          );
        }
      } else {
        setError(
          translateErrorMessage(
            err instanceof Error ? err.message : 'Failed to save receipt',
            locale,
          ),
        );
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

      <form
        id="receipt-draft-form"
        onSubmit={handleSubmit(onValidSubmit)}
        className="receipt-form"
        noValidate
      >
        {/* Header Information Card with Reusable FormField abstractions */}
        <div className="form-card">
          <h3 className="form-section-title">1. Document Header Information</h3>
          <div className="form-grid-3">
            <FormField
              label={t.receipts.warehouse}
              htmlFor="warehouseId"
              required
              error={errors.warehouseId?.message}
            >
              <select
                id="warehouseId"
                className="form-select"
                {...register('warehouseId')}
                disabled={saving}
              >
                <option value="">{t.receipts.selectWarehouse}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={t.receipts.supplier}
              htmlFor="supplierId"
              required
              error={errors.supplierId?.message}
            >
              <select
                id="supplierId"
                className="form-select"
                {...register('supplierId')}
                disabled={saving}
              >
                <option value="">{t.receipts.selectSupplier}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={t.receipts.date}
              htmlFor="receiptDate"
              required
              error={errors.receiptDate?.message}
            >
              <input
                id="receiptDate"
                type="date"
                className="form-input"
                {...register('receiptDate')}
                disabled={saving}
              />
            </FormField>

            <FormField
              label={t.receipts.receiptNumber}
              htmlFor="receiptNumber"
              helpText="Leave blank for auto-generation"
              error={errors.receiptNumber?.message}
            >
              <input
                id="receiptNumber"
                type="text"
                className="form-input"
                placeholder="e.g. REC-2026-001"
                {...register('receiptNumber')}
                disabled={saving}
              />
            </FormField>

            <FormField
              label={t.receipts.notes}
              htmlFor="notes"
              className="grid-span-2"
              error={errors.notes?.message}
            >
              <input
                id="notes"
                type="text"
                className="form-input"
                placeholder="Reference delivery note, PO #, bay number..."
                {...register('notes')}
                disabled={saving}
              />
            </FormField>
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

          {errors.lines?.root && (
            <p className="form-error-text" role="alert" style={{ marginBottom: '0.5rem' }}>
              {errors.lines.root.message}
            </p>
          )}

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
                {fields.map((field, idx) => {
                  const lineData = watchedLines?.[idx];
                  const qStr = lineData?.quantityReceived || '0';
                  const cStr = lineData?.unitCost || '0';
                  const qNum = parseFloat(qStr) || 0;
                  const cNum = parseFloat(cStr) || 0;
                  const linePreview = Math.round(qNum * cNum * 10000) / 10000;
                  const lineErrors = errors.lines?.[idx];

                  return (
                    <tr key={field.id}>
                      <td className="text-muted">{idx + 1}</td>
                      <td>
                        <select
                          className={`form-select form-select-sm ${lineErrors?.itemId ? 'has-error' : ''}`}
                          {...register(`lines.${idx}.itemId`)}
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
                        {lineErrors?.itemId && (
                          <span className="form-error-text" style={{ fontSize: '0.75rem' }}>
                            {lineErrors.itemId.message}
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          className={`form-input form-input-sm text-end ${lineErrors?.quantityReceived ? 'has-error' : ''}`}
                          {...register(`lines.${idx}.quantityReceived`)}
                          disabled={saving}
                          aria-label={`Line ${idx + 1} quantity`}
                        />
                        {lineErrors?.quantityReceived && (
                          <span className="form-error-text" style={{ fontSize: '0.75rem' }}>
                            {lineErrors.quantityReceived.message}
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0000"
                          className={`form-input form-input-sm text-end ${lineErrors?.unitCost ? 'has-error' : ''}`}
                          {...register(`lines.${idx}.unitCost`)}
                          disabled={saving}
                          aria-label={`Line ${idx + 1} unit cost`}
                        />
                        {lineErrors?.unitCost && (
                          <span className="form-error-text" style={{ fontSize: '0.75rem' }}>
                            {lineErrors.unitCost.message}
                          </span>
                        )}
                      </td>
                      <td className="text-end font-mono">{formatCurrency(linePreview)}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={fields.length <= 1 || saving}
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
            <span className="totals-label">{t.receipts.totalAmount} (Safe Decimal Preview):</span>
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

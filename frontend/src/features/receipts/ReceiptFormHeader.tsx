import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Supplier, Warehouse } from '../../types';
import { useLocale } from '../../hooks/useLocale';
import { FormField } from '../../components/FormField';

interface ReceiptFormHeaderProps {
  warehouses: Warehouse[];
  suppliers: Supplier[];
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  disabled: boolean;
}

export const ReceiptFormHeader: React.FC<ReceiptFormHeaderProps> = ({
  warehouses,
  suppliers,
  register,
  errors,
  disabled,
}) => {
  const { t } = useLocale();

  return (
    <div className="form-card">
      <h3 className="form-section-title">1. Document Header Information</h3>
      <div className="form-grid-3">
        <FormField
          label={t.receipts.warehouse}
          htmlFor="warehouseId"
          required
          error={errors.warehouseId?.message as string | undefined}
        >
          <select
            id="warehouseId"
            className="form-select"
            {...register('warehouseId')}
            disabled={disabled}
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
          error={errors.supplierId?.message as string | undefined}
        >
          <select
            id="supplierId"
            className="form-select"
            {...register('supplierId')}
            disabled={disabled}
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
          error={errors.receiptDate?.message as string | undefined}
        >
          <input
            id="receiptDate"
            type="date"
            className="form-input"
            {...register('receiptDate')}
            disabled={disabled}
          />
        </FormField>

        <FormField
          label={t.receipts.receiptNumber}
          htmlFor="receiptNumber"
          helpText="Leave blank for auto-generation"
          error={errors.receiptNumber?.message as string | undefined}
        >
          <input
            id="receiptNumber"
            type="text"
            className="form-input"
            placeholder="e.g. REC-2026-001"
            {...register('receiptNumber')}
            disabled={disabled}
          />
        </FormField>

        <FormField
          label={t.receipts.notes}
          htmlFor="notes"
          className="grid-span-2"
          error={errors.notes?.message as string | undefined}
        >
          <input
            id="notes"
            type="text"
            className="form-input"
            placeholder="Reference delivery note, PO #, bay number..."
            {...register('notes')}
            disabled={disabled}
          />
        </FormField>
      </div>
    </div>
  );
};

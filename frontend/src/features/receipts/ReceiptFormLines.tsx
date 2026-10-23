import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Item } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface ReceiptFormLinesProps {
  fields: Array<{ id: string }>;
  items: Item[];
  watchedLines: any[];
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  saving: boolean;
  previewTotal: string;
}

export const ReceiptFormLines: React.FC<ReceiptFormLinesProps> = ({
  fields,
  items,
  watchedLines,
  register,
  errors,
  onAddLine,
  onRemoveLine,
  saving,
  previewTotal,
}) => {
  const { t, formatCurrency } = useLocale();

  return (
    <div className="form-card">
      <div className="card-header-flex">
        <h3 className="form-section-title">2. {t.receipts.lines}</h3>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onAddLine}
          disabled={saving}
        >
          {t.receipts.addLine}
        </button>
      </div>

      {errors.lines?.root && (
        <p className="form-error-text" role="alert" style={{ marginBottom: '0.5rem' }}>
          {(errors.lines.root as any).message}
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
              const lineErrors = (errors.lines as any)?.[idx];

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
                      onClick={() => onRemoveLine(idx)}
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

      <div className="form-totals-summary">
        <span className="totals-label">{t.receipts.totalAmount} (Safe Decimal Preview):</span>
        <strong className="totals-amount">{formatCurrency(previewTotal)}</strong>
      </div>
    </div>
  );
};

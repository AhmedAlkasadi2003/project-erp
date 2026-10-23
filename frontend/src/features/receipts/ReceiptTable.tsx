import React from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../hooks/useLocale';
import { StatusBadge } from '../../components/StatusBadge';

interface ReceiptTableProps {
  receipts: Receipt[];
  onSelectReceipt: (id: string) => void;
  onEditReceipt: (id: string) => void;
  onPostTarget: (receipt: Receipt) => void;
  onVoidTarget: (receipt: Receipt) => void;
  onDeleteTarget: (receipt: Receipt) => void;
}

export const ReceiptTable: React.FC<ReceiptTableProps> = ({
  receipts,
  onSelectReceipt,
  onEditReceipt,
  onPostTarget,
  onVoidTarget,
  onDeleteTarget,
}) => {
  const { t, formatCurrency, formatDate } = useLocale();

  return (
    <div className="table-responsive">
      <table className="data-table" aria-label="Inventory Receipts Table">
        <thead>
          <tr>
            <th scope="col">{t.receipts.receiptNumber}</th>
            <th scope="col">{t.receipts.date}</th>
            <th scope="col">{t.receipts.supplier}</th>
            <th scope="col">{t.receipts.warehouse}</th>
            <th scope="col">{t.receipts.status}</th>
            <th scope="col" className="text-end">
              {t.receipts.totalAmount}
            </th>
            <th scope="col" className="text-center">
              {t.receipts.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id}>
              <td>
                <button
                  type="button"
                  className="link-button receipt-number-link"
                  onClick={() => onSelectReceipt(r.id)}
                  title={t.receipts.view}
                >
                  {r.receiptNumber}
                </button>
              </td>
              <td>{formatDate(r.receiptDate)}</td>
              <td>
                <span className="cell-supplier-name">
                  {r.supplier?.name || r.supplier?.code || r.supplierId}
                </span>
              </td>
              <td>
                <span className="cell-warehouse-name">
                  {r.warehouse?.name || r.warehouse?.code || r.warehouseId}
                </span>
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td className="text-end font-mono">
                <strong>{formatCurrency(r.totalAmount)}</strong>
              </td>
              <td>
                <div className="table-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onSelectReceipt(r.id)}
                    aria-label={`${t.receipts.view} ${r.receiptNumber}`}
                  >
                    {t.receipts.view}
                  </button>

                  {r.status === 'DRAFT' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => onEditReceipt(r.id)}
                        aria-label={`${t.receipts.edit} ${r.receiptNumber}`}
                      >
                        {t.receipts.edit}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onPostTarget(r)}
                        aria-label={`${t.receipts.post} ${r.receiptNumber}`}
                      >
                        {t.receipts.post}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => onDeleteTarget(r)}
                        aria-label={`${t.receipts.delete} ${r.receiptNumber}`}
                      >
                        {t.receipts.delete}
                      </button>
                    </>
                  )}

                  {r.status === 'POSTED' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => onVoidTarget(r)}
                      aria-label={`${t.receipts.void} ${r.receiptNumber}`}
                    >
                      {t.receipts.void}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

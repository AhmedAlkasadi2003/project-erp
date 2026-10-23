import React from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface ReceiptLinesTableProps {
  receipt: Receipt;
}

export const ReceiptLinesTable: React.FC<ReceiptLinesTableProps> = ({ receipt }) => {
  const { t, formatCurrency, formatQuantity } = useLocale();

  return (
    <div className="details-lines-card">
      <h3 className="section-title">{t.receipts.lines}</h3>
      <div className="table-responsive">
        <table className="data-table" aria-label="Receipt Line Items Breakdown">
          <thead>
            <tr>
              <th scope="col" style={{ width: '40px' }}>
                #
              </th>
              <th scope="col">{t.receipts.item}</th>
              <th scope="col" className="text-end">
                {t.receipts.quantity}
              </th>
              <th scope="col" className="text-end">
                {t.receipts.unitCost}
              </th>
              <th scope="col" className="text-end">
                {t.receipts.taxAmount}
              </th>
              <th scope="col" className="text-end">
                {t.receipts.lineTotal}
              </th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.id}>
                <td className="text-muted">{line.lineNumber}</td>
                <td>
                  <strong>{line.item?.sku || line.itemId}</strong>
                  {line.item?.name && <span className="item-sub-name"> — {line.item.name}</span>}
                  {line.notes && <p className="line-note-text">{line.notes}</p>}
                </td>
                <td className="text-end font-mono">
                  {formatQuantity(line.quantityReceived)}{' '}
                  <small className="text-muted">{line.item?.uom || ''}</small>
                </td>
                <td className="text-end font-mono">{formatCurrency(line.unitCost)}</td>
                <td className="text-end font-mono">{formatCurrency(line.taxAmount)}</td>
                <td className="text-end font-mono font-bold">
                  {formatCurrency(line.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals-summary-card">
        <div className="summary-row">
          <span>{t.receipts.subtotal}:</span>
          <span className="font-mono">{formatCurrency(receipt.subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>{t.receipts.taxAmount}:</span>
          <span className="font-mono">{formatCurrency(receipt.taxAmount)}</span>
        </div>
        <div className="summary-row summary-grand-total">
          <span>{t.receipts.totalAmount}:</span>
          <span className="font-mono font-bold grand-total-highlight">
            {formatCurrency(receipt.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
};

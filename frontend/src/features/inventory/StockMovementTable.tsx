import React from 'react';
import { StockCardResponse } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface StockMovementTableProps {
  movements: StockCardResponse['movements'];
}

export const StockMovementTable: React.FC<StockMovementTableProps> = ({ movements }) => {
  const { t } = useLocale();

  return (
    <div className="card table-card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-header-bar">
        <h3 className="card-title">{t.stockCard.movementHistory}</h3>
        <span className="badge badge-info">{t.stockCard.costingNote}</span>
      </div>

      {movements.length === 0 ? (
        <div className="empty-state">
          <p>{t.stockCard.noMovements}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.receipts.date}</th>
                <th>{t.stockCard.movementType}</th>
                <th>{t.stockCard.reference}</th>
                <th>{t.receipts.warehouse}</th>
                <th className="num-col">{t.receipts.quantity}</th>
                <th className="num-col">{t.stockCard.unitCost}</th>
                <th className="num-col">{t.stockCard.totalCost}</th>
                <th className="num-col highlight-col">{t.stockCard.runningQuantity}</th>
                <th className="num-col highlight-col">{t.stockCard.runningAverageCost}</th>
                <th>{t.stockCard.performedBy}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const isPositive = Number(m.quantity) >= 0;
                return (
                  <tr key={m.id}>
                    <td>{new Date(m.movementDate).toLocaleDateString()}</td>
                    <td>
                      <span
                        className={`badge ${
                          m.movementType === 'INBOUND'
                            ? 'badge-success'
                            : m.movementType === 'REVERSAL'
                              ? 'badge-warning'
                              : 'badge-danger'
                        }`}
                      >
                        {m.movementType}
                      </span>
                    </td>
                    <td>
                      <code>
                        {m.referenceType}: {m.referenceId?.substring(0, 8)}
                      </code>
                    </td>
                    <td>{m.warehouse?.name || '—'}</td>
                    <td className={`num-col ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? `+${Number(m.quantity).toFixed(2)}` : Number(m.quantity).toFixed(2)}
                    </td>
                    <td className="num-col">{Number(m.unitCost).toFixed(4)}</td>
                    <td className="num-col">{Number(m.totalCost).toFixed(2)}</td>
                    <td className="num-col highlight-col font-mono font-bold">
                      {Number(m.runningQuantity).toFixed(2)}
                    </td>
                    <td className="num-col highlight-col font-mono font-bold">
                      {Number(m.runningAverageCost).toFixed(4)}
                    </td>
                    <td>{m.performedBy?.name || m.performedBy?.email || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

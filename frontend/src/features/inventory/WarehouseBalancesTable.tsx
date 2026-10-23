import React from 'react';
import { StockCardResponse } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface WarehouseBalancesTableProps {
  currentBalances: NonNullable<StockCardResponse['currentBalances']>;
}

export const WarehouseBalancesTable: React.FC<WarehouseBalancesTableProps> = ({
  currentBalances,
}) => {
  const { t } = useLocale();

  if (!currentBalances || currentBalances.length === 0) return null;

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: '1rem' }}>
        {t.stockCard.currentOnHand}
      </h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.receipts.warehouse}</th>
              <th className="num-col">الرصيد الفعلي (On Hand)</th>
              <th className="num-col">المحجوز (Allocated)</th>
              <th className="num-col">المتاح (Available)</th>
              <th className="num-col">متوسط التكلفة</th>
              <th className="num-col">إجمالي القيمة</th>
            </tr>
          </thead>
          <tbody>
            {currentBalances.map((cb) => (
              <tr key={cb.warehouseId}>
                <td>
                  <strong>{cb.warehouse.name}</strong> ({cb.warehouse.code})
                </td>
                <td className="num-col font-bold">{Number(cb.onHandQuantity).toFixed(2)}</td>
                <td className="num-col">{Number(cb.allocatedQuantity).toFixed(2)}</td>
                <td className="num-col text-success font-bold">
                  {Number(cb.availableQuantity).toFixed(2)}
                </td>
                <td className="num-col">{Number(cb.averageCost).toFixed(4)}</td>
                <td className="num-col font-bold">{Number(cb.totalValue).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { getCompanyItems, getCompanyWarehouses } from '../../api/references';
import { getItemStockCard } from '../../api/inventory';
import { Item, StockCardResponse, Warehouse } from '../../types';
import { Alert } from '../common/Alert';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const StockCardView: React.FC = () => {
  const { company } = useAuth();
  const { t } = useLocale();

  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [stockCard, setStockCard] = useState<StockCardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    const fetchReferences = async () => {
      try {
        const [itemsData, whData] = await Promise.all([
          getCompanyItems(company.id),
          getCompanyWarehouses(company.id),
        ]);
        setItems(itemsData);
        setWarehouses(whData);
        if (itemsData.length > 0) {
          setSelectedItemId(itemsData[0].id);
        }
      } catch (err) {
        console.error('Failed to load items/warehouses', err);
      }
    };
    fetchReferences();
  }, [company]);

  const loadStockCard = async (itemId: string) => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getItemStockCard(itemId, {
        from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        to: dateTo ? new Date(dateTo).toISOString() : undefined,
        warehouseId: selectedWarehouseId || undefined,
      });
      setStockCard(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.common.error;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedItemId) {
      loadStockCard(selectedItemId);
    }
  }, [selectedItemId, selectedWarehouseId]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemId) {
      loadStockCard(selectedItemId);
    }
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedWarehouseId('');
    if (selectedItemId) {
      getItemStockCard(selectedItemId).then(setStockCard).catch(console.error);
    }
  };

  return (
    <div className="stock-card-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.stockCard.title}</h2>
          <p className="view-subtitle">{t.stockCard.subtitle}</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Filter and Selection Bar */}
      <div className="card filter-card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleFilterSubmit} className="stock-card-filters">
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="item-select" className="form-label">
                {t.stockCard.selectItemPrompt}
              </label>
              <select
                id="item-select"
                className="form-input form-select"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name} ({item.uom})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="warehouse-filter" className="form-label">
                {t.receipts.warehouse}
              </label>
              <select
                id="warehouse-filter"
                className="form-input form-select"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="">{t.stockCard.allWarehouses}</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="date-from" className="form-label">
                {t.receipts.dateFrom}
              </label>
              <input
                id="date-from"
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="date-to" className="form-label">
                {t.receipts.dateTo}
              </label>
              <input
                id="date-to"
                type="date"
                className="form-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {t.receipts.applyFilters}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleReset}
                disabled={loading}
              >
                {t.receipts.resetFilters}
              </button>
            </div>
          </div>
        </form>
      </div>

      {loading && <LoadingSpinner message={t.common.loading} />}

      {!loading && stockCard && (
        <>
          {/* Item Meta & Balances Banner */}
          <div className="stock-summary-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="summary-card">
              <span className="summary-label">{t.stockCard.openingBalance}</span>
              <span className="summary-value">
                {Number(stockCard.openingBalance.quantity).toFixed(2)} {stockCard.item.uom}
              </span>
              <span className="summary-sub">
                {t.stockCard.runningAverageCost}: {Number(stockCard.openingBalance.averageCost).toFixed(4)}
              </span>
              <span className="summary-sub">
                {t.stockCard.valuation}: {Number(stockCard.openingBalance.totalValue).toFixed(2)}
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">{t.stockCard.totalMovements}</span>
              <span className="summary-value">{stockCard.movements.length}</span>
              <span className="summary-sub">{stockCard.item.name}</span>
              <span className="summary-sub">
                {stockCard.item.sku} • {stockCard.item.valuationMethod}
              </span>
            </div>

            <div className="summary-card highlight">
              <span className="summary-label">{t.stockCard.closingBalance}</span>
              <span className="summary-value">
                {Number(stockCard.closingBalance.quantity).toFixed(2)} {stockCard.item.uom}
              </span>
              <span className="summary-sub">
                {t.stockCard.runningAverageCost}: {Number(stockCard.closingBalance.averageCost).toFixed(4)}
              </span>
              <span className="summary-sub">
                {t.stockCard.valuation}: {Number(stockCard.closingBalance.totalValue).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Chronological Ledger Table */}
          <div className="card table-card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header-bar">
              <h3 className="card-title">{t.stockCard.movementHistory}</h3>
              <span className="badge badge-info">{t.stockCard.costingNote}</span>
            </div>

            {stockCard.movements.length === 0 ? (
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
                    {stockCard.movements.map((m) => {
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
                            <code>{m.referenceType}: {m.referenceId?.substring(0, 8)}</code>
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

          {/* Current Stock Balances by Warehouse */}
          {stockCard.currentBalances && stockCard.currentBalances.length > 0 && (
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
                    {stockCard.currentBalances.map((cb) => (
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
          )}
        </>
      )}
    </div>
  );
};

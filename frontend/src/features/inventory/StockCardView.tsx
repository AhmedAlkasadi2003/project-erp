import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import { getCompanyItems, getCompanyWarehouses } from '../../services/references';
import { getItemStockCard } from '../../services/stock-card';
import { Item, StockCardResponse, Warehouse } from '../../types';
import { Alert } from '../../components/Alert';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StockCardSummaryCards } from './StockCardSummaryCards';
import { StockMovementTable } from './StockMovementTable';
import { WarehouseBalancesTable } from './WarehouseBalancesTable';

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

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1rem',
              alignItems: 'center',
            }}
          >
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
          <StockCardSummaryCards stockCard={stockCard} />
          <StockMovementTable movements={stockCard.movements} />
          {stockCard.currentBalances && (
            <WarehouseBalancesTable currentBalances={stockCard.currentBalances} />
          )}
        </>
      )}
    </div>
  );
};

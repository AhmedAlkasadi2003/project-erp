import React from 'react';
import { Supplier, Warehouse } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface ReceiptFilterToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  warehouseId: string;
  onWarehouseChange: (val: string) => void;
  supplierId: string;
  onSupplierChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  sortBy: 'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt';
  onSortByChange: (val: 'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (val: 'asc' | 'desc') => void;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  onApply: (e: React.FormEvent) => void;
  onReset: () => void;
}

export const ReceiptFilterToolbar: React.FC<ReceiptFilterToolbarProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  warehouseId,
  onWarehouseChange,
  supplierId,
  onSupplierChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  warehouses,
  suppliers,
  onApply,
  onReset,
}) => {
  const { t } = useLocale();

  return (
    <form onSubmit={onApply} className="filter-card">
      <div className="filter-grid">
        <div className="form-group">
          <label htmlFor="search-input" className="form-label">
            {t.receipts.searchPlaceholder}
          </label>
          <input
            id="search-input"
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.receipts.searchPlaceholder}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status-select" className="form-label">
            {t.receipts.status}
          </label>
          <select
            id="status-select"
            className="form-select"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">{t.statuses.ALL}</option>
            <option value="DRAFT">{t.statuses.DRAFT}</option>
            <option value="POSTED">{t.statuses.POSTED}</option>
            <option value="VOIDED">{t.statuses.VOIDED}</option>
            <option value="CANCELLED">{t.statuses.CANCELLED}</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="warehouse-select" className="form-label">
            {t.receipts.warehouse}
          </label>
          <select
            id="warehouse-select"
            className="form-select"
            value={warehouseId}
            onChange={(e) => onWarehouseChange(e.target.value)}
          >
            <option value="">{t.receipts.filterByWarehouse}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="supplier-select" className="form-label">
            {t.receipts.supplier}
          </label>
          <select
            id="supplier-select"
            className="form-select"
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
          >
            <option value="">{t.receipts.filterBySupplier}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date-from-input" className="form-label">
            {t.receipts.dateFrom}
          </label>
          <input
            id="date-from-input"
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="date-to-input" className="form-label">
            {t.receipts.dateTo}
          </label>
          <input
            id="date-to-input"
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-actions">
        <div className="sort-group">
          <label htmlFor="sort-by-select" className="form-label">
            {t.receipts.sortBy}
          </label>
          <select
            id="sort-by-select"
            className="form-select form-select-sm"
            value={sortBy}
            onChange={(e) =>
              onSortByChange(
                e.target.value as 'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt',
              )
            }
          >
            <option value="createdAt">{t.receipts.createdAt}</option>
            <option value="receiptDate">{t.receipts.date}</option>
            <option value="receiptNumber">{t.receipts.receiptNumber}</option>
            <option value="totalAmount">{t.receipts.totalAmount}</option>
          </select>

          <select
            id="sort-order-select"
            className="form-select form-select-sm"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">{t.receipts.desc}</option>
            <option value="asc">{t.receipts.asc}</option>
          </select>
        </div>

        <div className="filter-buttons">
          <button type="button" className="btn btn-outline btn-sm" onClick={onReset}>
            {t.receipts.resetFilters}
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            {t.receipts.applyFilters}
          </button>
        </div>
      </div>
    </form>
  );
};

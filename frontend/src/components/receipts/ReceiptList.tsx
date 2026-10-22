import React, { useEffect, useState, useCallback } from 'react';
import {
  PaginationMeta,
  QueryReceiptsParams,
  Receipt,
  ReceiptStatus,
  Supplier,
  Warehouse,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Alert } from '../common/Alert';
import { ConfirmModal } from '../common/ConfirmModal';
import { PostReceiptModal } from './PostReceiptModal';
import { VoidReceiptModal } from './VoidReceiptModal';
import * as receiptsApi from '../../api/receipts';
import * as referencesApi from '../../api/references';

interface ReceiptListProps {
  onSelectReceipt: (receiptId: string) => void;
  onEditReceipt: (receiptId: string) => void;
  onCreateNew: () => void;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({
  onSelectReceipt,
  onEditReceipt,
  onCreateNew,
}) => {
  const { user } = useAuth();
  const { t, formatCurrency, formatDate } = useLocale();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<
    'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [postTarget, setPostTarget] = useState<Receipt | null>(null);
  const [voidTarget, setVoidTarget] = useState<Receipt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadReferences = useCallback(async () => {
    if (!user?.companyId) return;
    try {
      const [whList, supList] = await Promise.all([
        referencesApi.getCompanyWarehouses(user.companyId),
        referencesApi.getCompanySuppliers(user.companyId),
      ]);
      setWarehouses(whList);
      setSuppliers(supList);
    } catch {
      // Ignore reference load errors
    }
  }, [user?.companyId]);

  const loadReceipts = useCallback(
    async (pageToLoad = meta.page, limitToLoad = meta.limit) => {
      setLoading(true);
      setError(null);
      try {
        const params: QueryReceiptsParams = {
          page: pageToLoad,
          limit: limitToLoad,
          sortBy,
          sortOrder,
        };

        if (search.trim()) params.search = search.trim();
        if (status) params.status = status as ReceiptStatus;
        if (warehouseId) params.warehouseId = warehouseId;
        if (supplierId) params.supplierId = supplierId;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await receiptsApi.getReceipts(params);
        setReceipts(res.data);
        setMeta(res.meta);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load receipts');
      } finally {
        setLoading(false);
      }
    },
    [
      meta.page,
      meta.limit,
      sortBy,
      sortOrder,
      search,
      status,
      warehouseId,
      supplierId,
      startDate,
      endDate,
    ],
  );

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    void loadReceipts(1, meta.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    void loadReceipts(1, meta.limit);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setWarehouseId('');
    setSupplierId('');
    setStartDate('');
    setEndDate('');
    setSortBy('createdAt');
    setSortOrder('desc');
    void loadReceipts(1, meta.limit);
  };

  const handleDeleteDraft = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await receiptsApi.deleteReceipt(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMessage(t.common.success);
      void loadReceipts(meta.page, meta.limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete receipt');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="receipt-list-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.receipts.listTitle}</h2>
          <p className="view-subtitle">{t.appSubtitle}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreateNew}>
          {t.receipts.createNewReceipt}
        </button>
      </div>

      {successMessage && (
        <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
      )}

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Filter Toolbar */}
      <form onSubmit={handleApplyFilters} className="filter-card">
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
              onChange={(e) => setSearch(e.target.value)}
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
              onChange={(e) => setStatus(e.target.value)}
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
              onChange={(e) => setWarehouseId(e.target.value)}
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
              onChange={(e) => setSupplierId(e.target.value)}
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
              onChange={(e) => setStartDate(e.target.value)}
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
              onChange={(e) => setEndDate(e.target.value)}
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
                setSortBy(
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
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="desc">{t.receipts.desc}</option>
              <option value="asc">{t.receipts.asc}</option>
            </select>
          </div>

          <div className="filter-buttons">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleResetFilters}>
              {t.receipts.resetFilters}
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              {t.receipts.applyFilters}
            </button>
          </div>
        </div>
      </form>

      {/* Main Table / Data View */}
      {loading ? (
        <LoadingSpinner message={t.common.loading} />
      ) : receipts.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon" aria-hidden="true">
            📋
          </div>
          <h3 className="empty-title">{t.receipts.noReceiptsFound}</h3>
          <p className="empty-desc">{t.receipts.noReceiptsSub}</p>
          <button type="button" className="btn btn-primary" onClick={onCreateNew}>
            {t.receipts.createNewReceipt}
          </button>
        </div>
      ) : (
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
                            onClick={() => setPostTarget(r)}
                            aria-label={`${t.receipts.post} ${r.receiptNumber}`}
                          >
                            {t.receipts.post}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteTarget(r)}
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
                          onClick={() => setVoidTarget(r)}
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
      )}

      {/* Pagination Footer */}
      {!loading && receipts.length > 0 && (
        <Pagination
          meta={meta}
          onPageChange={(page) => void loadReceipts(page, meta.limit)}
          onLimitChange={(limit) => void loadReceipts(1, limit)}
        />
      )}

      {/* Post Receipt Modal */}
      <PostReceiptModal
        receipt={postTarget}
        isOpen={!!postTarget}
        onClose={() => setPostTarget(null)}
        onSuccess={(updated) => {
          setSuccessMessage(`${t.common.success} (${updated.receiptNumber})`);
          void loadReceipts(meta.page, meta.limit);
        }}
        onError={(err) => setError(err)}
      />

      {/* Void Receipt Modal */}
      <VoidReceiptModal
        receipt={voidTarget}
        isOpen={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onSuccess={(updated) => {
          setSuccessMessage(`${t.common.success} (${updated.receiptNumber})`);
          void loadReceipts(meta.page, meta.limit);
        }}
        onError={(err) => setError(err)}
      />

      {/* Delete Draft Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title={t.receipts.deleteConfirmTitle}
        subtitle={t.receipts.deleteConfirmMessage}
        confirmLabel={t.receipts.delete}
        cancelLabel={t.common.cancel}
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDeleteDraft}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <p>
            {t.receipts.receiptNumber}: <strong>{deleteTarget.receiptNumber}</strong>
          </p>
        )}
      </ConfirmModal>
    </div>
  );
};

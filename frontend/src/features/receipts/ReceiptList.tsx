import React, { useEffect, useState, useCallback } from 'react';
import {
  PaginationMeta,
  QueryReceiptsParams,
  Receipt,
  Supplier,
  Warehouse,
} from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import { Pagination } from '../../components/Pagination';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Alert } from '../../components/Alert';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PostReceiptModal } from './PostReceiptModal';
import { VoidReceiptModal } from './VoidReceiptModal';
import { ReceiptFilterToolbar } from './ReceiptFilterToolbar';
import { ReceiptTable } from './ReceiptTable';
import { translateErrorMessage } from '../../utils/errorTranslator';
import * as receiptsApi from '../../services/receipts';
import * as referencesApi from '../../services/references';

interface ReceiptListProps {
  onSelectReceipt: (receiptId: string) => void;
  onEditReceipt: (receiptId: string) => void;
  onCreateNew: () => void;
}

const getUrlParams = () => {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  return {
    search: sp.get('search') || '',
    status: sp.get('status') || '',
    warehouseId: sp.get('warehouseId') || '',
    supplierId: sp.get('supplierId') || '',
    startDate: sp.get('startDate') || '',
    endDate: sp.get('endDate') || '',
    sortBy:
      (sp.get('sortBy') as 'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt') ||
      'createdAt',
    sortOrder: (sp.get('sortOrder') as 'asc' | 'desc') || 'desc',
    page: parseInt(sp.get('page') || '1', 10) || 1,
    limit: parseInt(sp.get('limit') || '10', 10) || 10,
  };
};

const updateUrlParams = (params: {
  search?: string;
  status?: string;
  warehouseId?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}) => {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams();
  if (params.search?.trim()) sp.set('search', params.search.trim());
  if (params.status) sp.set('status', params.status);
  if (params.warehouseId) sp.set('warehouseId', params.warehouseId);
  if (params.supplierId) sp.set('supplierId', params.supplierId);
  if (params.startDate) sp.set('startDate', params.startDate);
  if (params.endDate) sp.set('endDate', params.endDate);
  if (params.sortBy && params.sortBy !== 'createdAt') sp.set('sortBy', params.sortBy);
  if (params.sortOrder && params.sortOrder !== 'desc') sp.set('sortOrder', params.sortOrder);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  if (params.limit && params.limit !== 10) sp.set('limit', String(params.limit));

  const queryStr = sp.toString();
  const newUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
  window.history.replaceState(null, '', newUrl);
};

export const ReceiptList: React.FC<ReceiptListProps> = ({
  onSelectReceipt,
  onEditReceipt,
  onCreateNew,
}) => {
  const { user } = useAuth();
  const { t, locale } = useLocale();

  const initialParams = getUrlParams();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: initialParams.page || 1,
    limit: initialParams.limit || 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Filter & Search states
  const [search, setSearch] = useState<string>(initialParams.search || '');
  const [status, setStatus] = useState<string>(initialParams.status || '');
  const [warehouseId, setWarehouseId] = useState<string>(initialParams.warehouseId || '');
  const [supplierId, setSupplierId] = useState<string>(initialParams.supplierId || '');
  const [startDate, setStartDate] = useState<string>(initialParams.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialParams.endDate || '');
  const [sortBy, setSortBy] = useState<
    'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt'
  >(initialParams.sortBy || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialParams.sortOrder || 'desc');

  // Loading and Notifications
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Workflow Dialogs Targets
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
    } catch (err) {
      console.error('Failed to load warehouses/suppliers', err);
    }
  }, [user?.companyId]);

  const loadReceipts = useCallback(
    async (pageToLoad = 1, limitToLoad = 10) => {
      setLoading(true);
      setError(null);

      const params: QueryReceiptsParams = {
        page: pageToLoad,
        limit: limitToLoad,
        search: search.trim() || undefined,
        status: (status as Receipt['status']) || undefined,
        warehouseId: warehouseId || undefined,
        supplierId: supplierId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
      };

      updateUrlParams({
        search,
        status,
        warehouseId,
        supplierId,
        startDate,
        endDate,
        sortBy,
        sortOrder,
        page: pageToLoad,
        limit: limitToLoad,
      });

      try {
        const response = await receiptsApi.getReceipts(params);
        setReceipts(response.data);
        setMeta(response.meta);
      } catch (err) {
        setError(
          translateErrorMessage(
            err instanceof Error ? err.message : 'Failed to load receipts',
            locale,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [
      search,
      status,
      warehouseId,
      supplierId,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      locale,
    ],
  );

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  // Listen to browser Back/Forward navigation to restore filters seamlessly
  useEffect(() => {
    const handlePopState = () => {
      const p = getUrlParams();
      setSearch(p.search || '');
      setStatus(p.status || '');
      setWarehouseId(p.warehouseId || '');
      setSupplierId(p.supplierId || '');
      setStartDate(p.startDate || '');
      setEndDate(p.endDate || '');
      setSortBy(p.sortBy || 'createdAt');
      setSortOrder(p.sortOrder || 'desc');
      void loadReceipts(p.page || 1, p.limit || 10);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadReceipts]);

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
    updateUrlParams({});
    void loadReceipts(1, meta.limit);
  };

  const handleDeleteDraft = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await receiptsApi.deleteReceipt(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMessage(t.receipts.deletedSuccess);
      void loadReceipts(meta.page, meta.limit);
    } catch (err) {
      setError(
        translateErrorMessage(
          err instanceof Error ? err.message : 'Failed to delete receipt',
          locale,
        ),
      );
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

      <ReceiptFilterToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        warehouseId={warehouseId}
        onWarehouseChange={setWarehouseId}
        supplierId={supplierId}
        onSupplierChange={setSupplierId}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        warehouses={warehouses}
        suppliers={suppliers}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

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
        <ReceiptTable
          receipts={receipts}
          onSelectReceipt={onSelectReceipt}
          onEditReceipt={onEditReceipt}
          onPostTarget={setPostTarget}
          onVoidTarget={setVoidTarget}
          onDeleteTarget={setDeleteTarget}
        />
      )}

      {!loading && receipts.length > 0 && (
        <Pagination
          meta={meta}
          onPageChange={(page) => void loadReceipts(page, meta.limit)}
          onLimitChange={(limit) => void loadReceipts(1, limit)}
        />
      )}

      <PostReceiptModal
        receipt={postTarget}
        isOpen={!!postTarget}
        onClose={() => setPostTarget(null)}
        onSuccess={(updated) => {
          setSuccessMessage(`${t.receipts.postedSuccess} (${updated.receiptNumber})`);
          void loadReceipts(meta.page, meta.limit);
        }}
        onError={(err) => setError(translateErrorMessage(err, locale))}
      />

      <VoidReceiptModal
        receipt={voidTarget}
        isOpen={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onSuccess={(updated) => {
          setSuccessMessage(`${t.receipts.voidedSuccess} (${updated.receiptNumber})`);
          void loadReceipts(meta.page, meta.limit);
        }}
        onError={(err) => setError(translateErrorMessage(err, locale))}
      />

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

import React, { useEffect, useState, useCallback } from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Alert } from '../common/Alert';
import { ConfirmModal } from '../common/ConfirmModal';
import { PostReceiptModal } from './PostReceiptModal';
import { VoidReceiptModal } from './VoidReceiptModal';
import { translateErrorMessage } from '../../i18n/errorTranslator';
import * as receiptsApi from '../../api/receipts';

interface ReceiptDetailsProps {
  receiptId: string;
  onBack: () => void;
  onEdit: (receiptId: string) => void;
  onReceiptDeleted: () => void;
}

export const ReceiptDetails: React.FC<ReceiptDetailsProps> = ({
  receiptId,
  onBack,
  onEdit,
  onReceiptDeleted,
}) => {
  const { t, locale, formatCurrency, formatDate, formatQuantity } = useLocale();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await receiptsApi.getReceiptById(receiptId);
      setReceipt(data);
    } catch (err) {
      setError(
        translateErrorMessage(
          err instanceof Error ? err.message : 'Failed to fetch receipt details',
          locale,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [receiptId, locale]);

  useEffect(() => {
    void fetchReceipt();
  }, [fetchReceipt]);

  const handleDelete = async () => {
    if (!receipt) return;
    setDeleting(true);
    try {
      await receiptsApi.deleteReceipt(receipt.id);
      onReceiptDeleted();
    } catch (err) {
      setError(
        translateErrorMessage(
          err instanceof Error ? err.message : 'Failed to delete receipt',
          locale,
        ),
      );
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t.common.loading} />;
  }

  if (error || !receipt) {
    return (
      <div className="receipt-details-container">
        <Alert type="error" message={error || 'Receipt not found'} />
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t.common.back}
        </button>
      </div>
    );
  }

  return (
    <div className="receipt-details-container">
      {/* Top Header & Navigation */}
      <div className="details-header-bar">
        <div className="title-with-badge">
          <button type="button" className="btn btn-sm btn-outline back-btn" onClick={onBack}>
            &larr; {t.common.back}
          </button>
          <h2 className="details-title">
            {t.receipts.detailsTitle}: <span className="highlight-id">{receipt.receiptNumber}</span>
          </h2>
          <StatusBadge status={receipt.status} />
        </div>

        <div className="details-actions">
          {receipt.status === 'DRAFT' && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => onEdit(receipt.id)}>
                {t.receipts.edit}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowPostModal(true)}
              >
                {t.receipts.post}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowDeleteModal(true)}
              >
                {t.receipts.delete}
              </button>
            </>
          )}

          {receipt.status === 'POSTED' && (
            <button type="button" className="btn btn-danger" onClick={() => setShowVoidModal(true)}>
              {t.receipts.void}
            </button>
          )}

          <button type="button" className="btn btn-ghost" onClick={() => void fetchReceipt()}>
            🔄 {t.common.refresh}
          </button>
        </div>
      </div>

      {successMessage && (
        <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
      )}

      {/* Document Metadata Grid */}
      <div className="details-meta-grid">
        <div className="meta-card">
          <span className="meta-label">{t.receipts.receiptNumber}</span>
          <strong className="meta-value">{receipt.receiptNumber}</strong>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.date}</span>
          <span className="meta-value">{formatDate(receipt.receiptDate)}</span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.warehouse}</span>
          <span className="meta-value">
            {receipt.warehouse
              ? `${receipt.warehouse.name} (${receipt.warehouse.code})`
              : receipt.warehouseId}
          </span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.supplier}</span>
          <span className="meta-value">
            {receipt.supplier
              ? `${receipt.supplier.name} (${receipt.supplier.code})`
              : receipt.supplierId}
          </span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.createdAt}</span>
          <span className="meta-value">{formatDate(receipt.createdAt)}</span>
        </div>

        {receipt.postingDate && (
          <div className="meta-card">
            <span className="meta-label">{t.receipts.postedBy}</span>
            <span className="meta-value">
              {receipt.postedByUser
                ? `${receipt.postedByUser.firstName} ${receipt.postedByUser.lastName}`
                : receipt.postedById || 'System'}{' '}
              ({formatDate(receipt.postingDate)})
            </span>
          </div>
        )}

        {receipt.journalEntryId && (
          <div className="meta-card highlight-card">
            <span className="meta-label">{t.receipts.journalEntry}</span>
            <span className="meta-value font-mono">{receipt.journalEntryId}</span>
          </div>
        )}

        {receipt.voidedAt && (
          <div className="meta-card highlight-card-danger">
            <span className="meta-label">{t.receipts.voidedBy}</span>
            <span className="meta-value">
              {receipt.voidedByUser
                ? `${receipt.voidedByUser.firstName} ${receipt.voidedByUser.lastName}`
                : receipt.voidedById || 'System'}{' '}
              ({formatDate(receipt.voidedAt)})
            </span>
            {receipt.voidReason && (
              <p className="void-reason-text">
                <strong>{t.receipts.voidReason}:</strong> {receipt.voidReason}
              </p>
            )}
          </div>
        )}
      </div>

      {receipt.notes && (
        <div className="notes-banner">
          <strong>{t.receipts.notes}:</strong> {receipt.notes}
        </div>
      )}

      {/* Line Items Table */}
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

        {/* Financial Summary Box */}
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

      {/* Post Modal */}
      <PostReceiptModal
        receipt={receipt}
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onSuccess={(updated) => {
          setReceipt(updated);
          setSuccessMessage(t.receipts.postedSuccess);
        }}
        onError={(err) => setError(translateErrorMessage(err, locale))}
      />

      {/* Void Modal */}
      <VoidReceiptModal
        receipt={receipt}
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        onSuccess={(updated) => {
          setReceipt(updated);
          setSuccessMessage(t.receipts.voidedSuccess);
        }}
        onError={(err) => setError(translateErrorMessage(err, locale))}
      />

      {/* Delete Draft Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title={t.receipts.deleteConfirmTitle}
        subtitle={t.receipts.deleteConfirmMessage}
        confirmLabel={t.receipts.delete}
        cancelLabel={t.common.cancel}
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};

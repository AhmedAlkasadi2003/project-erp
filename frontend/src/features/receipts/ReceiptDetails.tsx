import React, { useEffect, useState, useCallback } from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../hooks/useLocale';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Alert } from '../../components/Alert';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PostReceiptModal } from './PostReceiptModal';
import { VoidReceiptModal } from './VoidReceiptModal';
import { ReceiptMetadataGrid } from './ReceiptMetadataGrid';
import { ReceiptLinesTable } from './ReceiptLinesTable';
import { translateErrorMessage } from '../../utils/errorTranslator';
import * as receiptsApi from '../../services/receipts';

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
  const { t, locale } = useLocale();

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
      <ReceiptMetadataGrid receipt={receipt} />

      {/* Line Items Table */}
      <ReceiptLinesTable receipt={receipt} />

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

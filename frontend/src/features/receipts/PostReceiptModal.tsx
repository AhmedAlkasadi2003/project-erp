import React, { useState } from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../hooks/useLocale';
import { ConfirmModal } from '../../components/ConfirmModal';
import * as receiptsApi from '../../services/receipts';
import { ApiError } from '../../services/client';

interface PostReceiptModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedReceipt: Receipt) => void;
  onError: (errorMsg: string) => void;
}

export const PostReceiptModal: React.FC<PostReceiptModalProps> = ({
  receipt,
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const { t, formatCurrency, formatDate } = useLocale();
  const [submitting, setSubmitting] = useState(false);

  if (!receipt) return null;

  const handlePost = async () => {
    setSubmitting(true);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `post-${receipt.id}-${Date.now()}`;

      const updated = await receiptsApi.postReceipt(receipt.id, idempotencyKey);
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onError(t.receipts.conflictError);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to post receipt';
        onError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t.postModal.title}
      subtitle={t.postModal.subtitle}
      confirmLabel={t.postModal.confirmButton}
      cancelLabel={t.postModal.cancelButton}
      confirmVariant="primary"
      loading={submitting}
      onConfirm={handlePost}
      onCancel={onClose}
    >
      <div className="modal-financial-preview">
        <div className="preview-row">
          <span className="preview-label">{t.receipts.receiptNumber}:</span>
          <strong className="preview-value">{receipt.receiptNumber}</strong>
        </div>
        <div className="preview-row">
          <span className="preview-label">{t.receipts.date}:</span>
          <span className="preview-value">{formatDate(receipt.receiptDate)}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">{t.receipts.warehouse}:</span>
          <span className="preview-value">{receipt.warehouse?.name || receipt.warehouseId}</span>
        </div>
        <div className="preview-row">
          <span className="preview-label">{t.receipts.supplier}:</span>
          <span className="preview-value">{receipt.supplier?.name || receipt.supplierId}</span>
        </div>
        <div className="preview-row preview-total-row">
          <span className="preview-label">{t.postModal.totalImpact}</span>
          <strong className="preview-value total-highlight">
            {formatCurrency(receipt.totalAmount)}
          </strong>
        </div>

        <div className="accounting-impact-box">
          <p className="impact-text-warning">{t.postModal.warningText}</p>
          <ul className="impact-entries-list">
            <li className="entry-debit">
              <span className="leg-tag">DEBIT</span> {t.postModal.debitText}
            </li>
            <li className="entry-credit">
              <span className="leg-tag">CREDIT</span> {t.postModal.creditText}
            </li>
          </ul>
        </div>
      </div>
    </ConfirmModal>
  );
};

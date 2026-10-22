import React, { useState } from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import { ConfirmModal } from '../common/ConfirmModal';
import * as receiptsApi from '../../api/receipts';

interface VoidReceiptModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedReceipt: Receipt) => void;
  onError: (errorMsg: string) => void;
}

export const VoidReceiptModal: React.FC<VoidReceiptModalProps> = ({
  receipt,
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const { t, formatCurrency } = useLocale();
  const [voidReason, setVoidReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!receipt) return null;

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      setValidationError(t.voidModal.reasonRequired);
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    try {
      const updated = await receiptsApi.voidReceipt(receipt.id, voidReason.trim());
      onSuccess(updated);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to void receipt';
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t.voidModal.title}
      subtitle={t.voidModal.subtitle}
      confirmLabel={t.voidModal.confirmButton}
      cancelLabel={t.voidModal.cancelButton}
      confirmVariant="danger"
      loading={submitting}
      onConfirm={handleVoid}
      onCancel={() => {
        setVoidReason('');
        setValidationError(null);
        onClose();
      }}
    >
      <div className="modal-financial-preview">
        <div className="preview-row">
          <span className="preview-label">{t.receipts.receiptNumber}:</span>
          <strong className="preview-value">{receipt.receiptNumber}</strong>
        </div>
        <div className="preview-row preview-total-row">
          <span className="preview-label">{t.receipts.totalAmount}:</span>
          <strong className="preview-value total-highlight">
            {formatCurrency(receipt.totalAmount)}
          </strong>
        </div>

        <div className="accounting-impact-box box-danger">
          <p className="impact-text-warning">{t.voidModal.warningText}</p>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="void-reason-input" className="form-label form-label-required">
            {t.voidModal.reasonLabel}
          </label>
          <textarea
            id="void-reason-input"
            className="form-textarea"
            rows={3}
            value={voidReason}
            onChange={(e) => {
              setVoidReason(e.target.value);
              if (e.target.value.trim()) setValidationError(null);
            }}
            placeholder={t.voidModal.reasonPlaceholder}
            required
            disabled={submitting}
          />
          {validationError && (
            <span className="form-error-text" role="alert">
              {validationError}
            </span>
          )}
        </div>
      </div>
    </ConfirmModal>
  );
};

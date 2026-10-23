import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  subtitle,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus confirm button on open
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={subtitle ? 'modal-subtitle' : undefined}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          {subtitle && (
            <p id="modal-subtitle" className="modal-subtitle">
              {subtitle}
            </p>
          )}
        </div>

        <div className="modal-body">{children}</div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={`btn btn-${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

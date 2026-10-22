import React from 'react';
import { ReceiptStatus } from '../../types';
import { useLocale } from '../../context/LocaleContext';

interface StatusBadgeProps {
  status: ReceiptStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useLocale();

  const getStyleClass = () => {
    switch (status) {
      case 'DRAFT':
        return 'status-badge-draft';
      case 'POSTED':
        return 'status-badge-posted';
      case 'VOIDED':
        return 'status-badge-voided';
      case 'CANCELLED':
        return 'status-badge-cancelled';
      default:
        return 'status-badge-default';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'DRAFT':
        return t.statuses.DRAFT;
      case 'POSTED':
        return t.statuses.POSTED;
      case 'VOIDED':
        return t.statuses.VOIDED;
      case 'CANCELLED':
        return t.statuses.CANCELLED;
      default:
        return status;
    }
  };

  return (
    <span
      className={`status-badge ${getStyleClass()}`}
      role="status"
      aria-label={`Status: ${getLabel()}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {getLabel()}
    </span>
  );
};

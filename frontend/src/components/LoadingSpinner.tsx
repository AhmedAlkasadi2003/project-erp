import React from 'react';
import { useLocale } from '../hooks/useLocale';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  const { t } = useLocale();
  const text = message || t.common.loading;

  return (
    <div className="loading-container" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span className="loading-text">{text}</span>
    </div>
  );
};

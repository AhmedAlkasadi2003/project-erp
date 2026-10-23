import React from 'react';

interface AlertProps {
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  details?: string[];
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, details, onClose }) => {
  return (
    <div className={`alert-banner alert-${type}`} role="alert">
      <div className="alert-content">
        <strong className="alert-title">{message}</strong>
        {details && details.length > 0 && (
          <ul className="alert-details-list">
            {details.map((detail, idx) => (
              <li key={idx}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          className="alert-close-btn"
          onClick={onClose}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
};

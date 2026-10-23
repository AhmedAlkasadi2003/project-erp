import React from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  required?: boolean;
  helpText?: string | null;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  required = false,
  helpText,
  className = '',
  children,
}) => {
  return (
    <div className={`form-group ${error ? 'has-error' : ''} ${className}`.trim()}>
      <label
        htmlFor={htmlFor}
        className={`form-label ${required ? 'form-label-required' : ''}`.trim()}
      >
        {label}
      </label>

      {children}

      {helpText && !error && (
        <span className="form-help-text" style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
          {helpText}
        </span>
      )}

      {error && (
        <span
          className="form-error-text"
          role="alert"
          aria-live="polite"
          style={{ fontSize: '0.8rem', color: 'var(--danger-600)', marginTop: '0.15rem' }}
        >
          {error}
        </span>
      )}
    </div>
  );
};

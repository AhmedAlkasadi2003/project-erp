import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { Alert } from '../common/Alert';

export const LoginForm: React.FC = () => {
  const { login, loading, error, clearError } = useAuth();
  const { t } = useLocale();

  const [companyCode, setCompanyCode] = useState('COMP-01');
  const [email, setEmail] = useState('admin@acme-erp.local');
  const [password, setPassword] = useState('Admin123!@#');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login({ companyCode, email, password });
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleQuickFill = (accCompany: string, accEmail: string, accPass: string) => {
    setCompanyCode(accCompany);
    setEmail(accEmail);
    setPassword(accPass);
    clearError();
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <h2 className="login-title">{t.login.title}</h2>
        <p className="login-subtitle">{t.login.subtitle}</p>
      </div>

      {error && <Alert type="error" message={error} onClose={clearError} />}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="company-code-input" className="form-label">
            {t.login.companyCode}
          </label>
          <input
            id="company-code-input"
            type="text"
            className="form-input"
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            required
            autoComplete="organization"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email-input" className="form-label">
            {t.login.email}
          </label>
          <input
            id="email-input"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password-input" className="form-label">
            {t.login.password}
          </label>
          <input
            id="password-input"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? t.login.submitting : t.login.submit}
        </button>
      </form>

      <div className="quick-login-section">
        <span className="quick-login-label">{t.login.quickAccounts}</span>
        <div className="quick-login-buttons">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => handleQuickFill('COMP-01', 'admin@acme-erp.local', 'Admin123!@#')}
          >
            {t.login.quickAdmin}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => handleQuickFill('COMP-01', 'clerk@acme-erp.local', 'Clerk123!@#')}
          >
            {t.login.quickClerk}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() =>
              handleQuickFill('COMP-01', 'accountant@acme-erp.local', 'Accountant123!@#')
            }
          >
            {t.login.quickAccountant}
          </button>
        </div>
      </div>
    </div>
  );
};

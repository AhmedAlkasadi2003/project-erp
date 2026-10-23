import React from 'react';
import { LoginForm } from '../features/auth/LoginForm';
import { useLocale } from '../hooks/useLocale';

export const LoginPage: React.FC = () => {
  const { locale, setLocale } = useLocale();

  return (
    <div className="workspace-container">
      <header className="workspace-header">
        <div className="header-top-row">
          <div className="badge">Phase 01 — Workspace Setup</div>
          <button
            type="button"
            className="btn btn-sm btn-ghost language-toggle"
            onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
            aria-label={`Switch language to ${locale === 'en' ? 'Arabic' : 'English'}`}
          >
            🌐 {locale === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
        <h1>Inventory Receipts ERP</h1>
        <p className="subtitle">
          Core development workspace & infrastructure verification shell
        </p>
      </header>

      <main className="workspace-main">
        <LoginForm />
      </main>
    </div>
  );
};

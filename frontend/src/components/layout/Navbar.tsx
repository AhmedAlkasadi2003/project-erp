import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

export type AppView = 'receipts' | 'create-receipt' | 'edit-receipt' | 'receipt-details' | 'health';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, company, logout } = useAuth();
  const { locale, setLocale, t } = useLocale();

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  };

  return (
    <header className="app-navbar" role="banner">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="brand-badge">ERP</div>
          <div className="brand-text">
            <h1 className="brand-title">{t.appName}</h1>
            {company && (
              <span className="brand-company">
                {company.name} ({company.code})
              </span>
            )}
          </div>
        </div>

        <nav className="navbar-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-link ${currentView === 'receipts' || currentView === 'receipt-details' ? 'active' : ''}`}
            onClick={() => onNavigate('receipts')}
            aria-current={currentView === 'receipts' ? 'page' : undefined}
          >
            {t.nav.receipts}
          </button>
          <button
            type="button"
            className={`nav-link ${currentView === 'create-receipt' ? 'active' : ''}`}
            onClick={() => onNavigate('create-receipt')}
            aria-current={currentView === 'create-receipt' ? 'page' : undefined}
          >
            {t.nav.newReceipt}
          </button>
          <button
            type="button"
            className={`nav-link ${currentView === 'health' ? 'active' : ''}`}
            onClick={() => onNavigate('health')}
            aria-current={currentView === 'health' ? 'page' : undefined}
          >
            {t.nav.systemHealth}
          </button>
        </nav>

        <div className="navbar-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost language-toggle"
            onClick={toggleLanguage}
            aria-label={`Switch language to ${locale === 'en' ? 'Arabic' : 'English'}`}
          >
            🌐 {locale === 'en' ? 'العربية' : 'English'}
          </button>

          {user && (
            <div className="user-profile-badge">
              <span className="user-name">
                {user.firstName} {user.lastName}
              </span>
              <span className="user-role-pill">{t.roles[user.role] || user.role}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline logout-btn"
                onClick={logout}
                aria-label={t.login.logout}
              >
                {t.login.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

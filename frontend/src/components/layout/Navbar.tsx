import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AppView } from '../../types';
import { getAuthorizedNavItems } from '../../config/navigation';

export type { AppView };

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

  const authorizedItems = getAuthorizedNavItems(user?.role);

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
          {authorizedItems.map((item) => {
            const isReceiptGroup =
              item.id === 'receipts' &&
              (currentView === 'receipts' || currentView === 'receipt-details');
            const isActive = currentView === item.id || isReceiptGroup;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                {t.nav[item.labelKey]}
              </button>
            );
          })}
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

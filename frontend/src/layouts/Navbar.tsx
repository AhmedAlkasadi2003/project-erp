import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../hooks/useLocale';
import { AppView } from '../types';
import { getAuthorizedNavItems } from '../routes/navigation';

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
            {company && <span className="brand-subtitle">{company.name}</span>}
          </div>
        </div>

        <nav className="navbar-links" aria-label="Main Navigation">
          {authorizedItems.map((item) => {
            const isActive =
              currentView === item.id ||
              (item.id === 'receipts' &&
                (currentView === 'receipt-details' || currentView === 'edit-receipt'));

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
            <div className="user-profile">
              <div className="user-info">
                <span className="user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="user-role-badge">{t.roles[user.role]}</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline btn-logout"
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

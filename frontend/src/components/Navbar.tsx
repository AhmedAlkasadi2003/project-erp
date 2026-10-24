import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../hooks/useLocale';
import { AppView } from '../types';
import { getAuthorizedNavItems, getPathForView } from '../routes';

export type { AppView };

interface NavbarProps {
  currentView?: AppView;
  onNavigate?: (view: AppView) => void;
}

const getNavIcon = (id: AppView) => {
  switch (id) {
    case 'receipts':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2 3-2 3 2V4a2 2 0 0 0-2-2z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h4" />
        </svg>
      );
    case 'create-receipt':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case 'stock-card':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'chart-of-accounts':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'accounting-periods':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'trial-balance':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case 'audit-trail':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    default:
      return null;
  }
};

const getUserInitials = (firstName?: string, lastName?: string): string => {
  const f = firstName?.trim().charAt(0) || '';
  const l = lastName?.trim().charAt(0) || '';
  return (f + l).toUpperCase() || 'U';
};

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, company, logout } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open to prevent background / horizontal shift
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Close drawer if screen resizes to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1150 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ar' : 'en');
  };

  const authorizedItems = getAuthorizedNavItems(user?.role);

  const handleNavClick = (id: AppView, path: string) => {
    if (onNavigate) {
      onNavigate(id);
    }
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleBrandClick = () => {
    if (onNavigate) {
      onNavigate('receipts');
    }
    navigate('/receipts');
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/login');
  };

  const isItemActive = (itemId: AppView, itemPath: string) => {
    return (
      location.pathname === itemPath ||
      (itemId === 'receipts' &&
        (location.pathname === '/receipts' ||
          location.pathname.startsWith('/receipts/') ||
          currentView === 'receipts' ||
          currentView === 'receipt-details' ||
          currentView === 'edit-receipt')) ||
      currentView === itemId
    );
  };

  return (
    <>
      <header className="app-navbar" role="banner">
        <div className="navbar-container">
          {/* Brand & Logo */}
          <div
            className="navbar-brand"
            onClick={handleBrandClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleBrandClick();
              }
            }}
          >
            <div className="brand-badge">
              <span>ERP</span>
            </div>
            <div className="brand-text">
              <h1 className="brand-title">{t.appName}</h1>
              {company && (
                <span className="brand-company">
                  <span className="company-status-dot" aria-hidden="true"></span>
                  <span className="brand-subtitle">{company.name}</span>
                </span>
              )}
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="navbar-links navbar-nav" aria-label="Main Navigation">
            {authorizedItems.map((item) => {
              const itemPath = item.path || getPathForView(item.id);
              const isActive = isItemActive(item.id, itemPath);

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id, itemPath)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-link-icon">{getNavIcon(item.id)}</span>
                  <span className="nav-link-label">{t.nav[item.labelKey]}</span>
                </button>
              );
            })}
          </nav>

          {/* Header Actions (Language, Profile, Mobile Menu Toggle) */}
          <div className="navbar-actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost language-toggle"
              onClick={toggleLanguage}
              aria-label={`Switch language to ${locale === 'en' ? 'Arabic' : 'English'}`}
              title={locale === 'en' ? 'Switch to Arabic' : 'التحويل للإنجليزية'}
            >
              <span className="lang-icon" aria-hidden="true">
                🌐
              </span>
              <span className="lang-label">{locale === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {user && (
              <div className="user-profile user-profile-badge">
                <div className="user-avatar-circle" aria-hidden="true">
                  {getUserInitials(user.firstName, user.lastName)}
                </div>
                <div className="user-info">
                  <span className="user-name">
                    {user.firstName} {user.lastName}
                  </span>
                  <span
                    className={`user-role-badge user-role-pill role-${user.role.toLowerCase()}`}
                  >
                    {t.roles[user.role]}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-logout"
                  onClick={handleLogout}
                  aria-label={t.login.logout}
                  title={t.login.logout}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="logout-text">{t.login.logout}</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              className={`mobile-menu-btn ${mobileMenuOpen ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              {mobileMenuOpen ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay and Panel */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-navigation-drawer"
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-title-area">
                <div className="brand-badge small">
                  <span>ERP</span>
                </div>
                <div className="mobile-drawer-brand">
                  <span className="mobile-brand-title">{t.appName}</span>
                  {company && (
                    <span className="mobile-brand-company">
                      <span className="company-status-dot" aria-hidden="true"></span>
                      {company.name}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="mobile-drawer-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close drawer"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {user && (
              <div className="mobile-user-card">
                <div className="user-avatar-circle" aria-hidden="true">
                  {getUserInitials(user.firstName, user.lastName)}
                </div>
                <div className="mobile-user-info">
                  <span className="mobile-user-name">
                    {user.firstName} {user.lastName}
                  </span>
                  <div className="mobile-user-meta">
                    <span
                      className={`user-role-badge user-role-pill role-${user.role.toLowerCase()}`}
                    >
                      {t.roles[user.role]}
                    </span>
                    <span className="mobile-user-email">{user.email}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mobile-drawer-body">
              <div className="mobile-nav-heading">
                {locale === 'ar' ? 'أقسام النظام' : 'System Sections'}
              </div>
              <nav className="mobile-nav-links" aria-label="Mobile Navigation Links">
                {authorizedItems.map((item) => {
                  const itemPath = item.path || getPathForView(item.id);
                  const active = isItemActive(item.id, itemPath);

                  return (
                    <button
                      key={`mobile-${item.id}`}
                      type="button"
                      className={`mobile-nav-item ${active ? 'active' : ''}`}
                      onClick={() => handleNavClick(item.id, itemPath)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="mobile-nav-icon">{getNavIcon(item.id)}</span>
                      <span className="mobile-nav-text">{t.nav[item.labelKey]}</span>
                      {active && (
                        <span className="mobile-nav-active-pill">
                          {locale === 'ar' ? 'نشط' : 'Active'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mobile-drawer-footer">
              <button
                type="button"
                className="btn btn-outline mobile-footer-lang-btn"
                onClick={toggleLanguage}
                aria-label={`Switch language to ${locale === 'en' ? 'Arabic' : 'English'}`}
              >
                <span>🌐</span>
                <span>{locale === 'en' ? 'العربية' : 'English'}</span>
              </button>

              {user && (
                <button
                  type="button"
                  className="btn btn-danger-outline mobile-footer-logout-btn"
                  onClick={handleLogout}
                  aria-label={t.login.logout}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>{t.login.logout}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

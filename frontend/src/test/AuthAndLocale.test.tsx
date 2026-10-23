import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginForm } from '../features/auth/LoginForm';
import { AuthProvider, useAuth } from '../store/AuthContext';
import { LocaleProvider, useLocale } from '../store/LocaleContext';
import * as authApi from '../services/auth';

vi.mock('../services/auth');

const DummyLocaleConsumer: React.FC = () => {
  const { locale, dir, setLocale, formatCurrency, formatDate, formatQuantity } = useLocale();
  return (
    <div>
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="current-dir">{dir}</span>
      <span data-testid="formatted-currency">{formatCurrency('1250.5000', 'USD')}</span>
      <span data-testid="formatted-date">{formatDate('2026-10-22')}</span>
      <span data-testid="formatted-quantity">{formatQuantity('45.7500')}</span>
      <button onClick={() => setLocale('ar')} data-testid="switch-to-ar">
        Switch to Arabic
      </button>
      <button onClick={() => setLocale('en')} data-testid="switch-to-en">
        Switch to English
      </button>
    </div>
  );
};

const DummyAuthConsumer: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
      <span data-testid="user-email">{user?.email || 'none'}</span>
      <button onClick={logout} data-testid="btn-logout">
        Logout
      </button>
    </div>
  );
};

describe('Auth & Localization Contexts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('LoginForm', () => {
    it('renders input fields and quick test accounts', () => {
      render(
        <LocaleProvider>
          <AuthProvider>
            <LoginForm />
          </AuthProvider>
        </LocaleProvider>,
      );

      expect(screen.getByLabelText(/Company Code/i)).toHaveValue('COMP-01');
      expect(screen.getByLabelText(/Email Address/i)).toHaveValue('admin@acme-erp.local');
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clerk/i })).toBeInTheDocument();
    });

    it('populates fields when a quick account button is clicked', () => {
      render(
        <LocaleProvider>
          <AuthProvider>
            <LoginForm />
          </AuthProvider>
        </LocaleProvider>,
      );

      const clerkButton = screen.getByRole('button', { name: /Clerk/i });
      fireEvent.click(clerkButton);

      expect(screen.getByLabelText(/Email Address/i)).toHaveValue('clerk@acme-erp.local');
    });

    it('invokes login API on submission', async () => {
      vi.spyOn(authApi, 'login').mockResolvedValue({
        accessToken: 'jwt-token-123',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'usr-1',
          companyId: 'comp-1',
          email: 'admin@acme-erp.local',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      });

      render(
        <LocaleProvider>
          <AuthProvider>
            <LoginForm />
          </AuthProvider>
        </LocaleProvider>,
      );

      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          companyCode: 'COMP-01',
          email: 'admin@acme-erp.local',
          password: 'Admin123!@#',
        });
      });
    });
  });

  describe('LocaleContext & RTL/LTR Formatting', () => {
    it('switches between English (LTR) and Arabic (RTL) updating document attributes', () => {
      render(
        <LocaleProvider>
          <DummyLocaleConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId('current-locale')).toHaveTextContent('en');
      expect(screen.getByTestId('current-dir')).toHaveTextContent('ltr');
      expect(document.documentElement.dir).toBe('ltr');
      expect(document.documentElement.lang).toBe('en');

      // Switch to Arabic
      fireEvent.click(screen.getByTestId('switch-to-ar'));

      expect(screen.getByTestId('current-locale')).toHaveTextContent('ar');
      expect(screen.getByTestId('current-dir')).toHaveTextContent('rtl');
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');
    });

    it('formats monetary values and quantities safely with 4 decimal places', () => {
      render(
        <LocaleProvider>
          <DummyLocaleConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId('formatted-currency')).toHaveTextContent('1,250.5000');
      expect(screen.getByTestId('formatted-quantity')).toHaveTextContent('45.7500');
    });
  });

  describe('AuthContext Session Management', () => {
    it('clears session on logout', async () => {
      localStorage.setItem('erp_token', 'valid-mock-token');

      vi.spyOn(authApi, 'getMe').mockResolvedValue({
        id: 'usr-1',
        companyId: 'comp-1',
        email: 'clerk@acme-erp.local',
        firstName: 'Jane',
        lastName: 'Clerk',
        role: 'CLERK',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });

      render(
        <AuthProvider>
          <DummyAuthConsumer />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
        expect(screen.getByTestId('user-email')).toHaveTextContent('clerk@acme-erp.local');
      });

      fireEvent.click(screen.getByTestId('btn-logout'));

      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
      expect(localStorage.getItem('erp_token')).toBeNull();
    });
  });
});

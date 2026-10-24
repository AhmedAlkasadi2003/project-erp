import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { AuthProvider } from '../hooks/useAuth';
import { LocaleProvider } from '../hooks/useLocale';
import * as authApi from '../services/auth';

vi.mock('../services/auth');

function renderNavbar(initialEntries = ['/receipts']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocaleProvider>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe('Responsive Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('erp_token', 'mock-jwt-token');

    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      id: 'usr-1',
      companyId: 'comp-1',
      email: 'admin@akemi.local',
      firstName: 'Ahmed',
      lastName: 'Kasadi',
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });

    vi.spyOn(authApi, 'getCurrentCompany').mockResolvedValue({
      id: 'comp-1',
      code: 'COMP-01',
      name: 'Akemi Company',
      currency: 'USD',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
  });

  it('renders brand elements, app name, and company subtitle correctly', async () => {
    renderNavbar();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('ERP')).toBeInTheDocument();
    expect(screen.getByText(/Receipts Management System|نظام إدارة السندات/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Akemi Company')).toBeInTheDocument();
    });
  });

  it('displays user avatar initials, user name, role badge, and logout button', async () => {
    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('Ahmed Kasadi')).toBeInTheDocument();
      expect(screen.getByText('AK')).toBeInTheDocument();
      expect(screen.getByText(/Administrator|مدير النظام/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign Out|تسجيل الخروج/i })).toBeInTheDocument();
    });
  });

  it('toggles language between English and Arabic when clicking language button', async () => {
    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('Ahmed Kasadi')).toBeInTheDocument();
    });

    const langBtn = screen.getByRole('button', {
      name: /Switch language to Arabic|Switch language to English/i,
    });
    expect(langBtn).toBeInTheDocument();

    fireEvent.click(langBtn);

    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
    });
  });

  it('opens and closes mobile navigation drawer via hamburger button and escape key', async () => {
    renderNavbar();

    await waitFor(() => {
      expect(screen.getByText('Ahmed Kasadi')).toBeInTheDocument();
    });

    const mobileMenuBtn = screen.getByRole('button', {
      name: /Open navigation menu/i,
    });
    expect(mobileMenuBtn).toBeInTheDocument();

    // Open mobile drawer
    fireEvent.click(mobileMenuBtn);

    expect(screen.getByRole('dialog', { name: /Navigation Menu/i })).toBeInTheDocument();

    // Close via Close button inside drawer
    const closeBtn = screen.getByRole('button', { name: /Close drawer/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Navigation Menu/i })).not.toBeInTheDocument();

    // Reopen and test closing with Escape key
    fireEvent.click(mobileMenuBtn);
    expect(screen.getByRole('dialog', { name: /Navigation Menu/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Navigation Menu/i })).not.toBeInTheDocument();
  });
});

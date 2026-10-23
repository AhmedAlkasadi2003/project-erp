import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('App Shell', () => {
  it('renders the clean login workspace header and Phase 01 badge without status card', () => {
    render(<App />);

    expect(screen.getByText(/Phase 01 — Workspace Setup/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inventory Receipts ERP');
    expect(screen.getByRole('button', { name: /Sign in|تسجيل الدخول/i })).toBeInTheDocument();
    // Verify status card is completely removed
    expect(screen.queryByLabelText('Infrastructure Status')).not.toBeInTheDocument();
  });

  it('verifies that System Health is not in the navigation or view hierarchy', () => {
    render(<App />);
    expect(screen.queryByText(/Technical Connection Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/حالة النظام/i)).not.toBeInTheDocument();
  });
});

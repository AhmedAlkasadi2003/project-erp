import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from '../App';
import { SystemHealth } from '../components/system/SystemHealth';
import * as healthApi from '../api/health';

vi.mock('../api/health');

describe('App Shell & SystemHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the clean login workspace header and Phase 01 badge without status card', () => {
    render(<App />);

    expect(screen.getByText(/Phase 01 — Workspace Setup/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inventory Receipts ERP');
    expect(screen.getByRole('button', { name: /Sign in|تسجيل الدخول/i })).toBeInTheDocument();
    // Verify status card is hidden from login screen
    expect(screen.queryByLabelText('Infrastructure Status')).not.toBeInTheDocument();
  });

  it('renders technical connection status inside SystemHealth component', async () => {
    vi.spyOn(healthApi, 'fetchBackendHealth').mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 42,
      environment: 'test',
      version: '0.1.0',
      services: {
        database: {
          status: 'up',
        },
      },
    });

    render(<SystemHealth />);

    expect(screen.getByText(/Technical Connection Status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Connected \(200 OK\)/i)).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  it('handles backend connection failure gracefully in SystemHealth', async () => {
    vi.spyOn(healthApi, 'fetchBackendHealth').mockRejectedValue(
      new Error('Network connection refused'),
    );

    render(<SystemHealth />);

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Network connection refused/i)).toBeInTheDocument();
    });
  });
});

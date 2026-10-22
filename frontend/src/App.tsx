import React, { useEffect, useState } from 'react';
import { fetchBackendHealth, HealthResponse } from './api/health';
import './App.css';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBackendHealth();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend service');
      setHealth(null);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void checkConnection();
  }, []);

  return (
    <div className="workspace-container">
      <header className="workspace-header">
        <div className="badge">Phase 01 — Workspace Setup</div>
        <h1>Inventory Receipts ERP</h1>
        <p className="subtitle">Core development workspace & infrastructure verification shell</p>
      </header>

      <main className="workspace-main">
        <section className="status-card" aria-label="Infrastructure Status">
          <div className="status-header">
            <h2>Technical Connection Status</h2>
            <button
              className="btn-refresh"
              onClick={() => void checkConnection()}
              disabled={loading}
              type="button"
            >
              {loading ? 'Checking...' : 'Recheck Status'}
            </button>
          </div>

          <div className="status-grid">
            <div className="status-item">
              <span className="label">Frontend Workspace</span>
              <span className="status-pill status-pill-success">Ready (Vite + React 19)</span>
            </div>

            <div className="status-item">
              <span className="label">Backend API Status</span>
              {loading ? (
                <span className="status-pill status-pill-pending">Probing...</span>
              ) : health ? (
                <span
                  className={`status-pill ${
                    health.status === 'ok' ? 'status-pill-success' : 'status-pill-warning'
                  }`}
                >
                  {health.status === 'ok' ? 'Connected (200 OK)' : 'Degraded'}
                </span>
              ) : (
                <span className="status-pill status-pill-error">Disconnected</span>
              )}
            </div>

            <div className="status-item">
              <span className="label">PostgreSQL Database</span>
              {loading ? (
                <span className="status-pill status-pill-pending">Checking...</span>
              ) : health?.services?.database ? (
                <span
                  className={`status-pill ${
                    health.services.database.status === 'up'
                      ? 'status-pill-success'
                      : 'status-pill-error'
                  }`}
                >
                  {health.services.database.status === 'up' ? 'Online' : 'Offline'}
                </span>
              ) : (
                <span className="status-pill status-pill-error">Unreachable</span>
              )}
            </div>

            <div className="status-item">
              <span className="label">Runtime Environment</span>
              <span className="status-pill status-pill-neutral">
                {health?.environment || 'development'}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <strong>Connection Warning:</strong> {error}
              <p className="error-hint">
                Ensure backend is running (
                <code>pnpm --filter @inventory-erp/backend start:dev</code>) and PostgreSQL
                container is up (<code>pnpm docker:up</code>).
              </p>
            </div>
          )}

          {lastChecked && (
            <div className="status-footer">
              <small>Last probed at: {lastChecked}</small>
            </div>
          )}
        </section>

        <section className="scope-boundary-card">
          <h3>Phase 01 Architectural Boundary Notice</h3>
          <p>
            This interface is strictly a development infrastructure probe. In compliance with Phase
            01 requirements, no business features, inventory screens, receipt workflows, or
            accounting ledger modules are present in this phase.
          </p>
          <div className="next-step-hint">
            <strong>Next Phase:</strong> Phase 02 will define PostgreSQL schemas, Prisma data
            models, and database migrations for inventory items, receipts, and general ledger
            journal entries.
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;

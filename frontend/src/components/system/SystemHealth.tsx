import React, { useEffect, useState } from 'react';
import { fetchBackendHealth, HealthResponse } from '../../api/health';

export const SystemHealth: React.FC = () => {
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
    <div className="system-health-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">Technical Connection Status</h2>
          <p className="view-subtitle">
            Core development workspace & infrastructure verification shell
          </p>
        </div>
        <button
          className="btn btn-primary btn-refresh"
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
            <span className="status-pill status-pill-error">Offline</span>
          )}
        </div>

        <div className="status-item">
          <span className="label">Environment</span>
          <span className="status-value">{health?.environment || 'unknown'}</span>
        </div>

        <div className="status-item">
          <span className="label">Server Uptime</span>
          <span className="status-value">
            {health?.uptime !== undefined ? `${Math.floor(health.uptime)}s` : 'N/A'}
          </span>
        </div>

        <div className="status-item">
          <span className="label">Last Health Probe</span>
          <span className="status-value">{lastChecked || 'N/A'}</span>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Connection Failure:</strong> {error}
        </div>
      )}
    </div>
  );
};

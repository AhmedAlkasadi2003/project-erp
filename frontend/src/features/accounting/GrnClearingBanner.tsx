import React from 'react';
import { InventoryAccountsConfig } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface GrnClearingBannerProps {
  config: InventoryAccountsConfig | null;
}

export const GrnClearingBanner: React.FC<GrnClearingBannerProps> = ({ config }) => {
  const { t } = useLocale();

  if (!config) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        background: '#f8fafc',
        borderLeft: '4px solid #3b82f6',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
            📌 {t.accounting.grnClearingTitle}
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            {t.accounting.grnClearingDesc}
          </p>
        </div>
        <div>
          {config.grnClearingAccount ? (
            <span
              className="badge badge-success font-mono"
              style={{ fontSize: '0.95rem', padding: '0.5rem 0.75rem' }}
            >
              {config.grnClearingAccount.code} — {config.grnClearingAccount.name} (
              {config.grnClearingAccount.type})
            </span>
          ) : (
            <span className="badge badge-warning">لم يتم تحديد حساب وسيط بعد</span>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import { getGlSubledgerReconciliation, getTrialBalance } from '../../services/trial-balance';
import { InventoryGlReconciliationResult, TrialBalanceResult } from '../../types';
import { Alert } from '../../components/Alert';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TrialBalanceSummaryCards } from './TrialBalanceSummaryCards';
import { TrialBalanceTable } from './TrialBalanceTable';
import { GlReconciliationCard } from './GlReconciliationCard';
import { exportToCsv, triggerPrint } from '../../utils/export';

export const TrialBalanceView: React.FC = () => {
  const { user } = useAuth();
  const { t, locale } = useLocale();

  const [asOfDate, setAsOfDate] = useState<string>('');
  const [tb, setTb] = useState<TrialBalanceResult | null>(null);
  const [recon, setRecon] = useState<InventoryGlReconciliationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized =
    user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT' || user?.role === 'SUPER_ADMIN';

  const loadReports = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const [tbRes, reconRes] = await Promise.all([
        getTrialBalance({
          asOfDate: asOfDate ? new Date(asOfDate).toISOString() : undefined,
        }),
        getGlSubledgerReconciliation(),
      ]);
      setTb(tbRes);
      setRecon(reconRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadReports();
    }
  }, [asOfDate, isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="view-container">
        <Alert
          type="error"
          message="صلاحيات غير كافية: استعراض ميزان المراجعة والتقارير المالية مقتصر على دور المحاسب (ACCOUNTANT) والمدير (ADMIN) فقط."
        />
      </div>
    );
  }

  const handleExportCsv = () => {
    if (!tb || !tb.accounts || tb.accounts.length === 0) return;
    const headers = [
      t.accounting.accountCode,
      t.accounting.accountName,
      t.accounting.accountType,
      locale === 'ar' ? 'مدين' : 'Debit',
      locale === 'ar' ? 'دائن' : 'Credit',
      locale === 'ar' ? 'الرصيد الصافي' : 'Net Balance',
    ];
    const rows = tb.accounts.map((acc) => [
      acc.code,
      acc.name,
      acc.type,
      acc.debit,
      acc.credit,
      acc.balance,
    ]);
    rows.push([
      'TOTAL',
      locale === 'ar' ? 'الإجمالي العام' : 'Total',
      '',
      tb.totalDebit,
      tb.totalCredit,
      tb.isBalanced ? t.accounting.balancedStatus : t.accounting.unbalancedStatus,
    ]);
    exportToCsv(`trial_balance_${asOfDate || new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="trial-balance-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.accounting.trialBalanceTitle}</h2>
          <p className="view-subtitle">{t.accounting.trialBalanceSubtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            disabled={!tb || tb.accounts.length === 0}
            title={t.common.exportCsv}
          >
            📥 {t.common.exportCsv}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={triggerPrint}
            disabled={!tb}
            title={t.common.printPdf}
          >
            🖨️ {t.common.printPdf}
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Date Filter Bar */}
      <div className="card filter-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label htmlFor="as-of-date-input" className="form-label" style={{ margin: 0 }}>
            {t.accounting.asOfDate}
          </label>
          <input
            id="as-of-date-input"
            type="date"
            className="form-input"
            style={{ maxWidth: '220px' }}
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setAsOfDate('')}
          >
            اليوم الحالي (Latest)
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner message={t.common.loading} />}

      {!loading && tb && (
        <>
          {/* Summary Balance Cards */}
          <TrialBalanceSummaryCards tb={tb} t={t} />

          {/* Trial Balance Table */}
          <TrialBalanceTable tb={tb} t={t} />

          {/* GL Subledger Reconciliation Section */}
          {recon && <GlReconciliationCard recon={recon} t={t} />}
        </>
      )}
    </div>
  );
};

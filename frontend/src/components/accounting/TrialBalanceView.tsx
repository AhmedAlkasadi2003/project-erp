import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { getGlSubledgerReconciliation, getTrialBalance } from '../../api/accounting';
import { InventoryGlReconciliationResult, TrialBalanceResult } from '../../types';
import { Alert } from '../common/Alert';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const TrialBalanceView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLocale();

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

  return (
    <div className="trial-balance-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.accounting.trialBalanceTitle}</h2>
          <p className="view-subtitle">{t.accounting.trialBalanceSubtitle}</p>
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
          <div className="stock-summary-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="summary-card">
              <span className="summary-label">{t.accounting.totalDebit}</span>
              <span className="summary-value font-mono font-bold text-success">
                {Number(tb.totalDebit).toFixed(2)}
              </span>
              <span className="summary-sub">إجمالي المبالغ المدينة المرحّلة</span>
            </div>

            <div className="summary-card">
              <span className="summary-label">{t.accounting.totalCredit}</span>
              <span className="summary-value font-mono font-bold text-primary">
                {Number(tb.totalCredit).toFixed(2)}
              </span>
              <span className="summary-sub">إجمالي المبالغ الدائنة المرحّلة</span>
            </div>

            <div className={`summary-card ${tb.isBalanced ? 'highlight' : ''}`} style={!tb.isBalanced ? { border: '2px solid #ef4444' } : undefined}>
              <span className="summary-label">حالة اتزان الميزان (Balanced Check)</span>
              <span className={`summary-value ${tb.isBalanced ? 'text-success' : 'text-danger'}`}>
                {tb.isBalanced ? '✓ متزن تماماً' : '⚠ غير متزن'}
              </span>
              <span className="summary-sub">
                {tb.isBalanced ? t.accounting.balancedStatus : `${t.accounting.unbalancedStatus} ${Math.abs(Number(tb.totalDebit) - Number(tb.totalCredit)).toFixed(4)}`}
              </span>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="card table-card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header-bar">
              <h3 className="card-title">جدول أرصدة دليل الحسابات</h3>
              <span className="badge badge-default">
                حتى: {new Date(tb.asOfDate).toLocaleDateString()}
              </span>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t.accounting.accountCode}</th>
                    <th>{t.accounting.accountName}</th>
                    <th>{t.accounting.accountType}</th>
                    <th className="num-col">المدين (Debit)</th>
                    <th className="num-col">الدائن (Credit)</th>
                    <th className="num-col font-bold">صافي الرصيد (Net Balance)</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.accounts.map((row) => (
                    <tr key={row.accountId}>
                      <td className="font-mono font-bold">{row.code}</td>
                      <td>{row.name}</td>
                      <td>
                        <span className={`badge ${row.type === 'ASSET' ? 'badge-info' : row.type === 'LIABILITY' ? 'badge-warning' : 'badge-default'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="num-col font-mono">
                        {Number(row.debit) > 0 ? Number(row.debit).toFixed(2) : '—'}
                      </td>
                      <td className="num-col font-mono">
                        {Number(row.credit) > 0 ? Number(row.credit).toFixed(2) : '—'}
                      </td>
                      <td className="num-col font-mono font-bold">
                        {Number(row.balance).toFixed(2)} ({row.normalBalance === 'DEBIT' ? 'Dr' : 'Cr'})
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ textAlign: 'end' }}>
                      الإجمالي العام:
                    </td>
                    <td className="num-col font-mono text-success">
                      {Number(tb.totalDebit).toFixed(2)}
                    </td>
                    <td className="num-col font-mono text-primary">
                      {Number(tb.totalCredit).toFixed(2)}
                    </td>
                    <td className="num-col font-mono" style={{ textAlign: 'center' }}>
                      {tb.isBalanced ? '✓ 0.00' : (Number(tb.totalDebit) - Number(tb.totalCredit)).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* GL Subledger Reconciliation Section */}
          {recon && (
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
                🔗 {t.accounting.reconciliationTitle}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                التحقق التلقائي المستمر من تطابق القيمة الدفترية لحركات المخزون الفعلية مع رصيد حساب أصول المخزون العام.
              </p>

              <div className="stock-summary-grid">
                <div className="summary-card">
                  <span className="summary-label">{t.accounting.subledgerValue}</span>
                  <span className="summary-value font-mono">
                    {Number(recon.subledgerTotalValue).toFixed(2)}
                  </span>
                  <span className="summary-sub">مجموع (الكمية × التكلفة المرجحة) لجميع الأصناف</span>
                </div>

                <div className="summary-card">
                  <span className="summary-label">{t.accounting.glAssetValue}</span>
                  <span className="summary-value font-mono">
                    {Number(recon.glInventoryAssetTotal).toFixed(2)}
                  </span>
                  <span className="summary-sub">رصيد حسابات أصول المخزون في دفتر الأستاذ العام</span>
                </div>

                <div className={`summary-card ${recon.isReconciled ? 'highlight' : ''}`}>
                  <span className="summary-label">{t.accounting.delta}</span>
                  <span className="summary-value font-mono text-success">
                    {Number(recon.delta).toFixed(4)}
                  </span>
                  <span className="summary-sub text-success font-bold">
                    ✓ {t.accounting.reconciledStatus}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

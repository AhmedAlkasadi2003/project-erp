import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import {
  closeAccountingPeriod,
  createAccountingPeriod,
  getAccountingPeriods,
} from '../../services/accounting-periods';
import { AccountingPeriod } from '../../types';
import { Alert } from '../../components/Alert';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ConfirmModal } from '../../components/ConfirmModal';

export const AccountingPeriodsView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLocale();

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  // Close Period Confirm
  const [closingPeriodId, setClosingPeriodId] = useState<string | null>(null);
  const [closing, setClosing] = useState<boolean>(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const canManage = isAdmin || isAccountant;

  const loadPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAccountingPeriods({
        status: (statusFilter as 'OPEN' | 'CLOSED') || undefined,
        limit: 50,
      });
      const list = res.data || (res as unknown as { items?: AccountingPeriod[] }).items || [];
      setPeriods(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, [statusFilter]);

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setCreating(true);
    setError(null);
    try {
      await createAccountingPeriod({
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      setSuccessMsg('تم إنشاء الفترة المحاسبية بنجاح');
      setShowCreateModal(false);
      setName('');
      setStartDate('');
      setEndDate('');
      loadPeriods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setCreating(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!closingPeriodId || !canManage) return;
    setClosing(true);
    setError(null);
    try {
      await closeAccountingPeriod(closingPeriodId);
      setSuccessMsg('تم إغلاق الفترة المحاسبية بنجاح ومنع الترحيل فيها');
      setClosingPeriodId(null);
      loadPeriods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="periods-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.accounting.periodsTitle}</h2>
          <p className="view-subtitle">{t.accounting.periodsSubtitle}</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + {t.accounting.newPeriod}
          </button>
        )}
      </div>

      {!canManage && (
        <Alert
          type="info"
          message={t.accounting.readOnlyNotice}
        />
      )}

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Filter Bar */}
      <div className="card filter-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label htmlFor="period-status-filter" className="form-label" style={{ margin: 0 }}>
            {t.accounting.periodStatus}:
          </label>
          <select
            id="period-status-filter"
            className="form-input form-select"
            style={{ maxWidth: '200px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t.statuses.ALL}</option>
            <option value="OPEN">مفتوحة (OPEN)</option>
            <option value="CLOSED">مغلقة (CLOSED)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message={t.common.loading} />
      ) : (
        <div className="card table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.accounting.periodName}</th>
                  <th>{t.accounting.startDate}</th>
                  <th>{t.accounting.endDate}</th>
                  <th>{t.accounting.periodStatus}</th>
                  <th>تاريخ الإغلاق</th>
                  {canManage && <th style={{ textAlign: 'center' }}>{t.receipts.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {(!periods || periods.length === 0) && (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      لا توجد فترات مالية مسجلة
                    </td>
                  </tr>
                )}
                {(periods || []).map((p) => {
                  const isOpen = p.status === 'OPEN';
                  return (
                    <tr key={p.id}>
                      <td className="font-bold">{p.name}</td>
                      <td>{new Date(p.startDate).toLocaleDateString()}</td>
                      <td>{new Date(p.endDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${isOpen ? 'badge-success' : 'badge-default'}`}>
                          {isOpen ? 'مفتوحة (OPEN)' : 'مغلقة (CLOSED)'}
                        </span>
                      </td>
                      <td>
                        {p.closedAt ? new Date(p.closedAt).toLocaleString() : '—'}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'center' }}>
                          {isOpen ? (
                            <button
                              type="button"
                              className="btn btn-xs btn-outline text-danger"
                              onClick={() => setClosingPeriodId(p.id)}
                            >
                              🔒 {t.accounting.closePeriod}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              مغلقة نهائياً
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">{t.accounting.newPeriod}</h3>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePeriod}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">{t.accounting.periodName}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="مثال: نوفمبر 2026 أو FY2026-M11"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t.accounting.startDate}</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.accounting.endDate}</label>
                    <input
                      type="date"
                      className="form-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  {t.common.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t.common.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Period Confirmation */}
      {closingPeriodId && (
        <ConfirmModal
          isOpen={Boolean(closingPeriodId)}
          title={t.accounting.closePeriod}
          subtitle={t.accounting.closePeriodConfirm}
          confirmLabel={t.accounting.closePeriod}
          cancelLabel={t.common.cancel}
          confirmVariant="danger"
          loading={closing}
          onConfirm={handleClosePeriod}
          onCancel={() => setClosingPeriodId(null)}
        />
      )}
    </div>
  );
};

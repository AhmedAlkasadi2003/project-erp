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
import { PeriodsTable } from './PeriodsTable';
import { PeriodFormModal } from './PeriodFormModal';

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
        <PeriodsTable
          periods={periods}
          canManage={canManage}
          onClosePeriod={(id) => setClosingPeriodId(id)}
          t={t}
        />
      )}

      {/* Create Modal */}
      <PeriodFormModal
        isOpen={showCreateModal}
        name={name}
        setName={setName}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        creating={creating}
        onSubmit={handleCreatePeriod}
        onClose={() => setShowCreateModal(false)}
        t={t}
      />

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

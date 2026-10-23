import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import { getAuditEvents } from '../../services/audit-trail';
import { AuditEvent, PaginationMeta } from '../../types';
import { Alert } from '../../components/Alert';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { AuditEventsTable } from './AuditEventsTable';
import { AuditEventDetailModal } from './AuditEventDetailModal';

export const AuditTrailView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLocale();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [entityType, setEntityType] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected event for inspecting metadata/changes
  const [inspectEvent, setInspectEvent] = useState<AuditEvent | null>(null);

  const isAuthorized =
    user?.role === 'ADMIN' ||
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'WAREHOUSE_MANAGER' ||
    user?.role === 'SUPER_ADMIN';

  const loadEvents = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditEvents({
        page,
        limit: 20,
        entityType: entityType || undefined,
        action: action || undefined,
      });
      const list = res.data || (res as unknown as { items?: AuditEvent[] }).items || [];
      setEvents(Array.isArray(list) ? list : []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadEvents();
    }
  }, [page, entityType, action, isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="view-container">
        <Alert
          type="error"
          message="صلاحيات غير كافية: استعراض سجلات التدقيق الأمني (Audit Trail) مقتصر على دور المحاسب (ACCOUNTANT) والمدير (ADMIN) فقط."
        />
      </div>
    );
  }

  return (
    <div className="audit-trail-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.audit.title}</h2>
          <p className="view-subtitle">{t.audit.subtitle}</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Filter Bar */}
      <div className="card filter-card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-grid-3">
          <div className="form-group">
            <label htmlFor="audit-entity-filter" className="form-label">
              {t.audit.entityType}:
            </label>
            <select
              id="audit-entity-filter"
              className="form-input form-select"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t.audit.allEntities}</option>
              <option value="RECEIPT">سندات الاستلام (RECEIPT)</option>
              <option value="STOCK_MOVEMENT">حركات المخزون (STOCK_MOVEMENT)</option>
              <option value="ACCOUNT">الحسابات المالية (ACCOUNT)</option>
              <option value="ACCOUNTING_PERIOD">الفترات المحاسبية (ACCOUNTING_PERIOD)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="audit-action-filter" className="form-label">
              {t.audit.action}:
            </label>
            <select
              id="audit-action-filter"
              className="form-input form-select"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t.audit.allActions}</option>
              <option value="POST">ترحيل (POST)</option>
              <option value="VOID">إلغاء وعكس (VOID)</option>
              <option value="CREATE">إنشاء (CREATE)</option>
              <option value="UPDATE">تعديل (UPDATE)</option>
              <option value="DELETE">حذف (DELETE)</option>
              <option value="CLOSE">إغلاق (CLOSE)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message={t.common.loading} />
      ) : events.length === 0 ? (
        <div className="card empty-state">
          <p>{t.audit.noEvents}</p>
        </div>
      ) : (
        <AuditEventsTable
          events={events}
          meta={meta}
          onInspect={(ev) => setInspectEvent(ev)}
          onPageChange={(newPage) => setPage(newPage)}
          t={t}
        />
      )}

      {/* Inspect Event Modal */}
      <AuditEventDetailModal
        event={inspectEvent}
        onClose={() => setInspectEvent(null)}
        t={t}
      />
    </div>
  );
};

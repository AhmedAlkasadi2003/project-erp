import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import { getAuditEvents } from '../../services/audit-trail';
import { AuditEvent, PaginationMeta } from '../../types';
import { Alert } from '../../components/Alert';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Pagination } from '../../components/Pagination';

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
        <div className="card table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.audit.timestamp}</th>
                  <th>{t.audit.user}</th>
                  <th>{t.audit.action}</th>
                  <th>{t.audit.entityType}</th>
                  <th>معرّف الكيان (Entity ID)</th>
                  <th style={{ textAlign: 'center' }}>{t.audit.details}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const isPost = ev.action === 'POST';
                  const isVoid = ev.action === 'VOID';
                  return (
                    <tr key={ev.id}>
                      <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <strong>{ev.user?.name || ev.user?.email || 'System'}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {ev.user?.email || ev.userId?.substring(0, 8)}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isPost
                              ? 'badge-success'
                              : isVoid
                              ? 'badge-danger'
                              : 'badge-info'
                          }`}
                        >
                          {ev.action}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-default">{ev.entityType}</span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                        <code>{ev.entityId}</code>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => setInspectEvent(ev)}
                        >
                          استعراض البيانات
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            meta={meta}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Inspect Event Modal */}
      {inspectEvent && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                تفاصيل حدث التدقيق: {inspectEvent.action} ({inspectEvent.entityType})
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setInspectEvent(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <div><strong>الوقت:</strong> {new Date(inspectEvent.createdAt).toLocaleString()}</div>
                <div><strong>المستخدم:</strong> {inspectEvent.user?.name} ({inspectEvent.user?.email})</div>
                <div><strong>الكيان:</strong> {inspectEvent.entityType} — <code>{inspectEvent.entityId}</code></div>
              </div>

              {inspectEvent.metadata && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">البيانات الوصفية (Metadata):</label>
                  <pre
                    style={{
                      background: '#0f172a',
                      color: '#38bdf8',
                      padding: '0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(inspectEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {inspectEvent.changes && (
                <div>
                  <label className="form-label">{t.audit.changes}:</label>
                  <pre
                    style={{
                      background: '#0f172a',
                      color: '#4ade80',
                      padding: '0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(inspectEvent.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setInspectEvent(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

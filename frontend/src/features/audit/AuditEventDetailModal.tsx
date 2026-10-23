import React from 'react';
import { AuditEvent } from '../../types';

interface AuditEventDetailModalProps {
  event: AuditEvent | null;
  onClose: () => void;
  t: {
    audit: {
      changes: string;
    };
  };
}

export const AuditEventDetailModal: React.FC<AuditEventDetailModalProps> = ({
  event,
  onClose,
  t,
}) => {
  if (!event) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            تفاصيل حدث التدقيق: {event.action} ({event.entityType})
          </h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '1rem' }}>
            <div>
              <strong>الوقت:</strong> {new Date(event.createdAt).toLocaleString()}
            </div>
            <div>
              <strong>المستخدم:</strong> {event.user?.name} ({event.user?.email})
            </div>
            <div>
              <strong>الكيان:</strong> {event.entityType} — <code>{event.entityId}</code>
            </div>
          </div>

          {event.metadata && (
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
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}

          {event.changes && (
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
                {JSON.stringify(event.changes, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

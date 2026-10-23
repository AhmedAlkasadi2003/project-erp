import React from 'react';
import { AuditEvent, PaginationMeta } from '../../types';
import { Pagination } from '../../components/Pagination';

interface AuditEventsTableProps {
  events: AuditEvent[];
  meta: PaginationMeta;
  onInspect: (ev: AuditEvent) => void;
  onPageChange: (newPage: number) => void;
  t: {
    audit: {
      timestamp: string;
      user: string;
      action: string;
      entityType: string;
      details: string;
    };
  };
}

export const AuditEventsTable: React.FC<AuditEventsTableProps> = ({
  events,
  meta,
  onInspect,
  onPageChange,
  t,
}) => {
  return (
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
                      onClick={() => onInspect(ev)}
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

      <Pagination meta={meta} onPageChange={onPageChange} />
    </div>
  );
};

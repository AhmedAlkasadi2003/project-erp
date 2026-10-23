import React from 'react';
import { AccountingPeriod } from '../../types';

interface PeriodsTableProps {
  periods: AccountingPeriod[];
  canManage: boolean;
  onClosePeriod: (periodId: string) => void;
  t: {
    accounting: {
      periodName: string;
      startDate: string;
      endDate: string;
      periodStatus: string;
      closePeriod: string;
    };
    receipts: {
      actions: string;
    };
  };
}

export const PeriodsTable: React.FC<PeriodsTableProps> = ({
  periods,
  canManage,
  onClosePeriod,
  t,
}) => {
  return (
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
                <td
                  colSpan={canManage ? 6 : 5}
                  style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}
                >
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
                  <td>{p.closedAt ? new Date(p.closedAt).toLocaleString() : '—'}</td>
                  {canManage && (
                    <td style={{ textAlign: 'center' }}>
                      {isOpen ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline text-danger"
                          onClick={() => onClosePeriod(p.id)}
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
  );
};

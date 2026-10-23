import React from 'react';
import { Account, InventoryAccountsConfig } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface AccountsTableProps {
  accounts: Account[];
  config: InventoryAccountsConfig | null;
  canEdit: boolean;
  canDelete: boolean;
  onSetGrnClearing: (id: string) => void;
  onOpenEdit: (acc: Account) => void;
  onDelete: (id: string) => void;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({
  accounts,
  config,
  canEdit,
  canDelete,
  onSetGrnClearing,
  onOpenEdit,
  onDelete,
}) => {
  const { t } = useLocale();

  return (
    <div className="card table-card">
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.accounting.accountCode}</th>
              <th>{t.accounting.accountName}</th>
              <th>{t.accounting.accountType}</th>
              <th>{t.accounting.normalBalance}</th>
              <th>{t.accounting.activeStatus}</th>
              <th style={{ textAlign: 'center' }}>خصائص وميزات</th>
              {canEdit && <th style={{ textAlign: 'center' }}>{t.receipts.actions}</th>}
            </tr>
          </thead>
          <tbody>
            {(!accounts || accounts.length === 0) && (
              <tr>
                <td
                  colSpan={canEdit ? 7 : 6}
                  style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}
                >
                  لا توجد حسابات مسجلة تطابق معايير البحث
                </td>
              </tr>
            )}
            {(accounts || []).map((acc) => {
              const isGrn = config?.grnClearingAccountId === acc.id;
              return (
                <tr key={acc.id} style={isGrn ? { backgroundColor: '#f0f9ff' } : undefined}>
                  <td className="font-mono font-bold">{acc.code}</td>
                  <td>
                    <strong>{acc.name}</strong>
                    {acc.description && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{acc.description}</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        acc.type === 'ASSET'
                          ? 'badge-info'
                          : acc.type === 'LIABILITY'
                            ? 'badge-warning'
                            : 'badge-default'
                      }`}
                    >
                      {acc.type}
                    </span>
                  </td>
                  <td>
                    <span className="badge">{acc.normalBalance}</span>
                  </td>
                  <td>
                    <span className={`badge ${acc.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {acc.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isGrn && (
                      <span
                        className="badge badge-success font-bold"
                        title="حساب وسيط البضائع الافتراضي"
                      >
                        ✓ وسيط البضائع (GRN)
                      </span>
                    )}
                    {acc.isSystem && (
                      <span className="badge badge-default" style={{ marginInlineStart: '0.25rem' }}>
                        نظامي
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        {canEdit && acc.type === 'LIABILITY' && !isGrn && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() => onSetGrnClearing(acc.id)}
                            title={t.accounting.setGrnClearing}
                          >
                            تعيين GRN
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => onOpenEdit(acc)}
                        >
                          {t.receipts.edit}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline text-danger"
                            onClick={() => onDelete(acc.id)}
                            disabled={acc.isSystem || isGrn}
                            title={
                              acc.isSystem || isGrn
                                ? 'لا يمكن حذف الحسابات النظامية أو الوسيطة'
                                : t.accounting.deleteAccount
                            }
                          >
                            {t.receipts.delete}
                          </button>
                        )}
                      </div>
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

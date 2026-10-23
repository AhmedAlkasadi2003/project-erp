import React from 'react';
import { TrialBalanceResult } from '../../types';

interface TrialBalanceTableProps {
  tb: TrialBalanceResult;
  t: {
    accounting: {
      accountCode: string;
      accountName: string;
      accountType: string;
    };
  };
}

export const TrialBalanceTable: React.FC<TrialBalanceTableProps> = ({ tb, t }) => {
  return (
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
                  <span
                    className={`badge ${
                      row.type === 'ASSET'
                        ? 'badge-info'
                        : row.type === 'LIABILITY'
                          ? 'badge-warning'
                          : 'badge-default'
                    }`}
                  >
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
                {tb.isBalanced
                  ? '✓ 0.00'
                  : (Number(tb.totalDebit) - Number(tb.totalCredit)).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

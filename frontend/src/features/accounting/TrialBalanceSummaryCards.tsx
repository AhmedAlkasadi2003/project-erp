import React from 'react';
import { TrialBalanceResult } from '../../types';

interface TrialBalanceSummaryCardsProps {
  tb: TrialBalanceResult;
  t: {
    accounting: {
      totalDebit: string;
      totalCredit: string;
      balancedStatus: string;
      unbalancedStatus: string;
    };
  };
}

export const TrialBalanceSummaryCards: React.FC<TrialBalanceSummaryCardsProps> = ({
  tb,
  t,
}) => {
  return (
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

      <div
        className={`summary-card ${tb.isBalanced ? 'highlight' : ''}`}
        style={!tb.isBalanced ? { border: '2px solid #ef4444' } : undefined}
      >
        <span className="summary-label">حالة اتزان الميزان (Balanced Check)</span>
        <span className={`summary-value ${tb.isBalanced ? 'text-success' : 'text-danger'}`}>
          {tb.isBalanced ? '✓ متزن تماماً' : '⚠ غير متزن'}
        </span>
        <span className="summary-sub">
          {tb.isBalanced
            ? t.accounting.balancedStatus
            : `${t.accounting.unbalancedStatus} ${Math.abs(Number(tb.totalDebit) - Number(tb.totalCredit)).toFixed(4)}`}
        </span>
      </div>
    </div>
  );
};

import React from 'react';
import { InventoryGlReconciliationResult } from '../../types';

interface GlReconciliationCardProps {
  recon: InventoryGlReconciliationResult;
  t: {
    accounting: {
      reconciliationTitle: string;
      subledgerValue: string;
      glAssetValue: string;
      delta: string;
      reconciledStatus: string;
    };
  };
}

export const GlReconciliationCard: React.FC<GlReconciliationCardProps> = ({ recon, t }) => {
  return (
    <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
      <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
        🔗 {t.accounting.reconciliationTitle}
      </h3>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        التحقق التلقائي المستمر من تطابق القيمة الدفترية لحركات المخزون الفعلية مع رصيد حساب أصول
        المخزون العام.
      </p>

      <div className="stock-summary-grid">
        <div className="summary-card">
          <span className="summary-label">{t.accounting.subledgerValue}</span>
          <span className="summary-value font-mono">
            {Number(recon.subledgerTotalValue).toFixed(2)}
          </span>
          <span className="summary-sub">مجموع (الكمية × التكلفة المرجحة) لجميع الأصناف</span>
        </div>

        <div className="summary-card">
          <span className="summary-label">{t.accounting.glAssetValue}</span>
          <span className="summary-value font-mono">
            {Number(recon.glInventoryAssetTotal).toFixed(2)}
          </span>
          <span className="summary-sub">رصيد حسابات أصول المخزون في دفتر الأستاذ العام</span>
        </div>

        <div className={`summary-card ${recon.isReconciled ? 'highlight' : ''}`}>
          <span className="summary-label">{t.accounting.delta}</span>
          <span className="summary-value font-mono text-success">
            {Number(recon.delta).toFixed(4)}
          </span>
          <span className="summary-sub text-success font-bold">
            ✓ {t.accounting.reconciledStatus}
          </span>
        </div>
      </div>
    </div>
  );
};

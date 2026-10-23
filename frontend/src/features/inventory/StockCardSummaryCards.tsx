import React from 'react';
import { StockCardResponse } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface StockCardSummaryCardsProps {
  stockCard: StockCardResponse;
}

export const StockCardSummaryCards: React.FC<StockCardSummaryCardsProps> = ({ stockCard }) => {
  const { t } = useLocale();

  return (
    <div className="stock-summary-grid" style={{ marginBottom: '1.5rem' }}>
      <div className="summary-card">
        <span className="summary-label">{t.stockCard.openingBalance}</span>
        <span className="summary-value">
          {Number(stockCard.openingBalance.quantity).toFixed(2)} {stockCard.item.uom}
        </span>
        <span className="summary-sub">
          {t.stockCard.runningAverageCost}:{' '}
          {Number(stockCard.openingBalance.averageCost).toFixed(4)}
        </span>
        <span className="summary-sub">
          {t.stockCard.valuation}: {Number(stockCard.openingBalance.totalValue).toFixed(2)}
        </span>
      </div>

      <div className="summary-card">
        <span className="summary-label">{t.stockCard.totalMovements}</span>
        <span className="summary-value">{stockCard.movements.length}</span>
        <span className="summary-sub">{stockCard.item.name}</span>
        <span className="summary-sub">
          {stockCard.item.sku} • {stockCard.item.valuationMethod}
        </span>
      </div>

      <div className="summary-card highlight">
        <span className="summary-label">{t.stockCard.closingBalance}</span>
        <span className="summary-value">
          {Number(stockCard.closingBalance.quantity).toFixed(2)} {stockCard.item.uom}
        </span>
        <span className="summary-sub">
          {t.stockCard.runningAverageCost}:{' '}
          {Number(stockCard.closingBalance.averageCost).toFixed(4)}
        </span>
        <span className="summary-sub">
          {t.stockCard.valuation}: {Number(stockCard.closingBalance.totalValue).toFixed(2)}
        </span>
      </div>
    </div>
  );
};

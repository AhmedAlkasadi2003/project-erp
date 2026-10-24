import React from 'react';
import { Receipt } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface ReceiptMetadataGridProps {
  receipt: Receipt;
}

export const ReceiptMetadataGrid: React.FC<ReceiptMetadataGridProps> = ({ receipt }) => {
  const { t, locale, formatDate } = useLocale();

  return (
    <>
      <div className="details-meta-grid">
        <div className="meta-card">
          <span className="meta-label">{t.receipts.receiptNumber}</span>
          <strong className="meta-value">{receipt.receiptNumber}</strong>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.date}</span>
          <span className="meta-value">{formatDate(receipt.receiptDate)}</span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.warehouse}</span>
          <span className="meta-value">
            {receipt.warehouse
              ? `${receipt.warehouse.name} (${receipt.warehouse.code})`
              : receipt.warehouseId}
          </span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.supplier}</span>
          <span className="meta-value">
            {receipt.supplier
              ? `${receipt.supplier.name} (${receipt.supplier.code})`
              : receipt.supplierId}
          </span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t.receipts.createdAt}</span>
          <span className="meta-value">{formatDate(receipt.createdAt)}</span>
        </div>

        {receipt.postingDate && (
          <div className="meta-card">
            <span className="meta-label">{t.receipts.postedBy}</span>
            <span className="meta-value">
              {receipt.postedByUser
                ? `${receipt.postedByUser.firstName} ${receipt.postedByUser.lastName}`
                : receipt.postedById || 'System'}{' '}
              ({formatDate(receipt.postingDate)})
            </span>
          </div>
        )}

        {receipt.journalEntryId && (
          <div className="meta-card highlight-card">
            <span className="meta-label">{t.receipts.journalEntry}</span>
            <span className="meta-value font-mono">{receipt.journalEntryId}</span>
          </div>
        )}

        {receipt.voidedAt && (
          <div className="meta-card highlight-card-danger">
            <span className="meta-label">{t.receipts.voidedBy}</span>
            <span className="meta-value">
              {receipt.voidedByUser
                ? `${receipt.voidedByUser.firstName} ${receipt.voidedByUser.lastName}`
                : receipt.voidedById || 'System'}{' '}
              ({formatDate(receipt.voidedAt)})
            </span>
            {receipt.voidReason && (
              <p className="void-reason-text">
                <strong>{t.receipts.voidReason}:</strong> {receipt.voidReason}
              </p>
            )}
          </div>
        )}
      </div>

      {receipt.notes && (
        <div className="notes-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📎</span>
            <strong>{t.receipts.notes} & {locale === 'ar' ? 'المرفقات' : 'Attachments'}:</strong>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--gray-800)' }}>
            {receipt.notes.split(/\s+/).some((part) => part.startsWith('http://') || part.startsWith('https://')) ? (
              receipt.notes.split(/(\s+)/).map((word, idx) =>
                word.startsWith('http://') || word.startsWith('https://') ? (
                  <a
                    key={idx}
                    href={word}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary-600)', textDecoration: 'underline', wordBreak: 'break-all' }}
                  >
                    🔗 {word}
                  </a>
                ) : (
                  <span key={idx}>{word}</span>
                ),
              )
            ) : (
              receipt.notes
            )}
          </div>
        </div>
      )}
    </>
  );
};

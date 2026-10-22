import React from 'react';
import { PaginationMeta } from '../../types';
import { useLocale } from '../../context/LocaleContext';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ meta, onPageChange, onLimitChange }) => {
  const { t } = useLocale();

  if (meta.totalPages <= 1 && meta.total <= meta.limit) {
    return null;
  }

  const pageOfText = t.pagination.pageOf
    .replace('{page}', String(meta.page))
    .replace('{totalPages}', String(meta.totalPages || 1));

  return (
    <nav className="pagination-bar" aria-label="Pagination Navigation">
      <div className="pagination-info">
        <span>
          {t.pagination.showing}{' '}
          <strong>{meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}</strong> -{' '}
          <strong>{Math.min(meta.page * meta.limit, meta.total)}</strong> {t.pagination.of}{' '}
          <strong>{meta.total}</strong> {t.pagination.items}
        </span>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={!meta.hasPrevPage}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label={t.pagination.previous}
        >
          &larr; {t.pagination.previous}
        </button>

        <span className="pagination-page-indicator" aria-current="page">
          {pageOfText}
        </span>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label={t.pagination.next}
        >
          {t.pagination.next} &rarr;
        </button>

        {onLimitChange && (
          <div className="pagination-limit-select">
            <label htmlFor="per-page-select" className="sr-only">
              {t.pagination.perPage}
            </label>
            <select
              id="per-page-select"
              value={meta.limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="form-select form-select-sm"
            >
              <option value="5">5 {t.pagination.perPage}</option>
              <option value="10">10 {t.pagination.perPage}</option>
              <option value="20">20 {t.pagination.perPage}</option>
              <option value="50">50 {t.pagination.perPage}</option>
            </select>
          </div>
        )}
      </div>
    </nav>
  );
};

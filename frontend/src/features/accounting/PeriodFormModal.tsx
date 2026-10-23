import React from 'react';

interface PeriodFormModalProps {
  isOpen: boolean;
  name: string;
  setName: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  t: {
    accounting: {
      newPeriod: string;
      periodName: string;
      startDate: string;
      endDate: string;
    };
    common: {
      cancel: string;
      saving: string;
      save: string;
    };
  };
}

export const PeriodFormModal: React.FC<PeriodFormModalProps> = ({
  isOpen,
  name,
  setName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  creating,
  onSubmit,
  onClose,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">{t.accounting.newPeriod}</h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">{t.accounting.periodName}</label>
              <input
                type="text"
                className="form-input"
                placeholder="مثال: نوفمبر 2026 أو FY2026-M11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div
              className="form-grid-2"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label">{t.accounting.startDate}</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.accounting.endDate}</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={creating}
            >
              {t.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

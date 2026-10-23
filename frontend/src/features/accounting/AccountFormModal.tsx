import React from 'react';
import { Account, AccountNormalBalance, AccountType } from '../../types';
import { useLocale } from '../../hooks/useLocale';

interface AccountFormModalProps {
  isOpen: boolean;
  editingAccount: Account | null;
  code: string;
  onCodeChange: (val: string) => void;
  name: string;
  onNameChange: (val: string) => void;
  type: AccountType;
  onTypeChange: (val: AccountType) => void;
  normalBalance: AccountNormalBalance;
  onNormalBalanceChange: (val: AccountNormalBalance) => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  isOpen,
  editingAccount,
  code,
  onCodeChange,
  name,
  onNameChange,
  type,
  onTypeChange,
  normalBalance,
  onNormalBalanceChange,
  description,
  onDescriptionChange,
  onClose,
  onSubmit,
}) => {
  const { t } = useLocale();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">
            {editingAccount ? t.accounting.editAccount : t.accounting.newAccount}
          </h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">{t.accounting.accountCode}</label>
              <input
                type="text"
                className="form-input"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                required
                disabled={Boolean(editingAccount)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">{t.accounting.accountName}</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
              />
            </div>

            {!editingAccount && (
              <div
                className="form-grid-2"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div className="form-group">
                  <label className="form-label">{t.accounting.accountType}</label>
                  <select
                    className="form-input form-select"
                    value={type}
                    onChange={(e) => {
                      const val = e.target.value as AccountType;
                      onTypeChange(val);
                      onNormalBalanceChange(
                        val === 'ASSET' || val === 'EXPENSE' ? 'DEBIT' : 'CREDIT',
                      );
                    }}
                  >
                    <option value="ASSET">ASSET (أصول)</option>
                    <option value="LIABILITY">LIABILITY (خصوم / التزامات)</option>
                    <option value="EQUITY">EQUITY (حقوق ملكية)</option>
                    <option value="REVENUE">REVENUE (إيرادات)</option>
                    <option value="EXPENSE">EXPENSE (مصروفات)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.accounting.normalBalance}</label>
                  <select
                    className="form-input form-select"
                    value={normalBalance}
                    onChange={(e) =>
                      onNormalBalanceChange(e.target.value as AccountNormalBalance)
                    }
                  >
                    <option value="DEBIT">مدين (DEBIT)</option>
                    <option value="CREDIT">دائن (CREDIT)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">الوصف والملاحظات</label>
              <textarea
                className="form-input"
                rows={3}
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import {
  createAccount,
  deleteAccount,
  getAccounts,
  getInventoryAccountsConfig,
  updateAccount,
  updateInventoryAccountsConfig,
} from '../../services/chart-of-accounts';
import { Account, AccountNormalBalance, AccountType, InventoryAccountsConfig } from '../../types';
import { Alert } from '../../components/Alert';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ConfirmModal } from '../../components/ConfirmModal';
import { GrnClearingBanner } from './GrnClearingBanner';
import { AccountsTable } from './AccountsTable';
import { AccountFormModal } from './AccountFormModal';

export const ChartOfAccountsView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLocale();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<InventoryAccountsConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

  // Modals
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType>('ASSET');
  const [normalBalance, setNormalBalance] = useState<AccountNormalBalance>('DEBIT');
  const [description, setDescription] = useState<string>('');

  // Delete Confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const canEdit = isAdmin || isAccountant;
  const canDelete = isAdmin; // Only ADMIN can delete accounts!

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, cfgRes] = await Promise.all([
        getAccounts({
          search: search || undefined,
          type: (selectedType as AccountType) || undefined,
          limit: 100,
        }),
        getInventoryAccountsConfig(),
      ]);
      const list = accRes.data || (accRes as unknown as { items?: Account[] }).items || [];
      setAccounts(Array.isArray(list) ? list : []);
      setConfig(cfgRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedType]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setCode('');
    setName('');
    setType('ASSET');
    setNormalBalance('DEBIT');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setCode(acc.code);
    setName(acc.name);
    setType(acc.type);
    setNormalBalance(acc.normalBalance);
    setDescription(acc.description || '');
    setShowModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name,
          description: description || undefined,
        });
        setSuccessMsg(t.receipts.updatedSuccess);
      } else {
        await createAccount({
          code,
          name,
          type,
          normalBalance,
          description: description || undefined,
        });
        setSuccessMsg(t.receipts.createdSuccess);
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(deleteId);
      setSuccessMsg(t.receipts.deletedSuccess);
      setDeleteId(null);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetGrnClearing = async (accountId: string) => {
    if (!canEdit) return;
    try {
      await updateInventoryAccountsConfig(accountId);
      setSuccessMsg(t.accounting.grnClearingUpdated);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    }
  };

  return (
    <div className="coa-container">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t.accounting.accountsTitle}</h2>
          <p className="view-subtitle">{t.accounting.accountsSubtitle}</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            + {t.accounting.newAccount}
          </button>
        )}
      </div>

      {!canEdit && <Alert type="info" message={t.accounting.readOnlyNotice} />}

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && (
        <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      {/* GRN Clearing Configuration Banner */}
      <GrnClearingBanner config={config} />

      {/* Search and Filters */}
      <div className="card filter-card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-grid-3">
          <div className="form-group">
            <label htmlFor="coa-search" className="form-label">
              {t.receipts.searchPlaceholder}
            </label>
            <input
              id="coa-search"
              type="text"
              className="form-input"
              placeholder="ابحث بالرمز أو اسم الحساب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="coa-type" className="form-label">
              {t.accounting.accountType}
            </label>
            <select
              id="coa-type"
              className="form-input form-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">جميع التصنيفات</option>
              <option value="ASSET">أصول (ASSET)</option>
              <option value="LIABILITY">خصوم / التزامات (LIABILITY)</option>
              <option value="EQUITY">حقوق ملكية (EQUITY)</option>
              <option value="REVENUE">إيرادات (REVENUE)</option>
              <option value="EXPENSE">مصروفات (EXPENSE)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message={t.common.loading} />
      ) : (
        <AccountsTable
          accounts={accounts}
          config={config}
          canEdit={canEdit}
          canDelete={canDelete}
          onSetGrnClearing={handleSetGrnClearing}
          onOpenEdit={handleOpenEdit}
          onDelete={setDeleteId}
        />
      )}

      {/* Create / Edit Modal */}
      <AccountFormModal
        isOpen={showModal}
        editingAccount={editingAccount}
        code={code}
        onCodeChange={setCode}
        name={name}
        onNameChange={setName}
        type={type}
        onTypeChange={setType}
        normalBalance={normalBalance}
        onNormalBalanceChange={setNormalBalance}
        description={description}
        onDescriptionChange={setDescription}
        onClose={() => setShowModal(false)}
        onSubmit={handleSaveAccount}
      />

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <ConfirmModal
          isOpen={Boolean(deleteId)}
          title={t.accounting.deleteConfirmTitle}
          subtitle={t.accounting.deleteConfirmMessage}
          confirmLabel={t.receipts.delete}
          cancelLabel={t.common.cancel}
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
};

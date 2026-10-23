import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { Navbar, AppView } from './components/layout/Navbar';
import { LoginForm } from './components/auth/LoginForm';
import { ReceiptList } from './components/receipts/ReceiptList';
import { ReceiptForm } from './components/receipts/ReceiptForm';
import { ReceiptDetails } from './components/receipts/ReceiptDetails';
import { StockCardView } from './components/inventory/StockCardView';
import { ChartOfAccountsView } from './components/accounting/ChartOfAccountsView';
import { AccountingPeriodsView } from './components/accounting/AccountingPeriodsView';
import { TrialBalanceView } from './components/accounting/TrialBalanceView';
import { AuditTrailView } from './components/audit/AuditTrailView';
import { SystemHealth } from './components/system/SystemHealth';
import { Alert } from './components/common/Alert';
import { canUserAccessView } from './config/navigation';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { t, locale, setLocale } = useLocale();

  const [currentView, setCurrentView] = useState<AppView>('receipts');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Active view guard: redirect to default authorized view if role lacks permission
  React.useEffect(() => {
    if (user && !canUserAccessView(user.role, currentView)) {
      setCurrentView('receipts');
      setSelectedReceiptId(null);
    }
  }, [user, currentView]);

  const handleNavigate = (view: AppView) => {
    if (user && !canUserAccessView(user.role, view)) {
      setNotification({
        type: 'warning',
        message: t.receipts.permissionDenied,
      });
      return;
    }
    setCurrentView(view);
    if (view !== 'edit-receipt' && view !== 'receipt-details') {
      setSelectedReceiptId(null);
    }
  };

  const handleSelectReceipt = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setCurrentView('receipt-details');
  };

  const handleEditReceipt = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setCurrentView('edit-receipt');
  };

  const handleCreateNew = () => {
    setSelectedReceiptId(null);
    setCurrentView('create-receipt');
  };

  const handleSavedReceipt = (receipt: { id: string; receiptNumber?: string }) => {
    const isEdit = Boolean(selectedReceiptId);
    setSelectedReceiptId(receipt.id);
    setCurrentView('receipt-details');
    const msg = isEdit ? t.receipts.updatedSuccess : t.receipts.createdSuccess;
    setNotification({
      type: 'success',
      message: `${msg} (${receipt.receiptNumber || receipt.id})`,
    });
  };

  const handleReceiptDeleted = () => {
    setSelectedReceiptId(null);
    setCurrentView('receipts');
    setNotification({
      type: 'success',
      message: t.receipts.deletedSuccess,
    });
  };

  return (
    <div className="app-layout">
      {isAuthenticated && user ? (
        <>
          <Navbar currentView={currentView} onNavigate={handleNavigate} />
          <main className="app-main-content">
            {notification && (
              <div style={{ marginBottom: '1.25rem' }}>
                <Alert
                  type={notification.type}
                  message={notification.message}
                  onClose={() => setNotification(null)}
                />
              </div>
            )}
            {currentView === 'receipts' && (
              <ReceiptList
                onSelectReceipt={handleSelectReceipt}
                onEditReceipt={handleEditReceipt}
                onCreateNew={handleCreateNew}
              />
            )}
            {currentView === 'create-receipt' && (
              <ReceiptForm
                onSaved={handleSavedReceipt}
                onCancel={() => handleNavigate('receipts')}
              />
            )}
            {currentView === 'edit-receipt' && selectedReceiptId && (
              <ReceiptForm
                receiptId={selectedReceiptId}
                onSaved={handleSavedReceipt}
                onCancel={() => handleNavigate('receipt-details')}
              />
            )}
            {currentView === 'receipt-details' && selectedReceiptId && (
              <ReceiptDetails
                receiptId={selectedReceiptId}
                onBack={() => handleNavigate('receipts')}
                onEdit={handleEditReceipt}
                onReceiptDeleted={handleReceiptDeleted}
              />
            )}
            {currentView === 'stock-card' && <StockCardView />}
            {currentView === 'chart-of-accounts' && <ChartOfAccountsView />}
            {currentView === 'accounting-periods' && <AccountingPeriodsView />}
            {currentView === 'trial-balance' && <TrialBalanceView />}
            {currentView === 'audit-trail' && <AuditTrailView />}
            {currentView === 'health' && <SystemHealth />}
          </main>
        </>
      ) : (
        <div className="workspace-container">
          <header className="workspace-header">
            <div className="header-top-row">
              <div className="badge">Phase 01 — Workspace Setup</div>
              <button
                type="button"
                className="btn btn-sm btn-ghost language-toggle"
                onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
                aria-label={`Switch language to ${locale === 'en' ? 'Arabic' : 'English'}`}
              >
                🌐 {locale === 'en' ? 'العربية' : 'English'}
              </button>
            </div>
            <h1>Inventory Receipts ERP</h1>
            <p className="subtitle">
              Core development workspace & infrastructure verification shell
            </p>
          </header>

          <main className="workspace-main">
            <LoginForm />
          </main>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LocaleProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LocaleProvider>
  );
};

export default App;

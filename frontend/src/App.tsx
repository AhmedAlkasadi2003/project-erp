import React, { useState, useEffect } from 'react';
import { AuthProvider } from './store/AuthContext';
import { LocaleProvider } from './store/LocaleContext';
import { useAuth } from './hooks/useAuth';
import { useLocale } from './hooks/useLocale';
import { MainLayout } from './layouts/MainLayout';
import { RouteGuard } from './routes/RouteGuard';
import { canUserAccessView } from './routes/navigation';
import { AppView } from './types';
import {
  LoginPage,
  ReceiptsPage,
  CreateReceiptPage,
  StockCardPage,
  ChartOfAccountsPage,
  AccountingPeriodsPage,
  TrialBalancePage,
  AuditTrailPage,
} from './pages';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLocale();

  const [currentView, setCurrentView] = useState<AppView>('receipts');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Active view guard: redirect to default authorized view if role lacks permission
  useEffect(() => {
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

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  return (
    <MainLayout
      currentView={currentView}
      onNavigate={handleNavigate}
      notification={notification}
      onDismissNotification={() => setNotification(null)}
    >
      {(currentView === 'receipts' ||
        currentView === 'receipt-details' ||
        currentView === 'edit-receipt') && (
        <RouteGuard view={currentView} role={user.role}>
          <ReceiptsPage
            subView={
              currentView === 'receipt-details'
                ? 'details'
                : currentView === 'edit-receipt'
                  ? 'edit'
                  : 'list'
            }
            selectedReceiptId={selectedReceiptId}
            onSelectReceipt={handleSelectReceipt}
            onEditReceipt={handleEditReceipt}
            onCreateNew={handleCreateNew}
            onSavedReceipt={handleSavedReceipt}
            onReceiptDeleted={handleReceiptDeleted}
            onBackToList={() => handleNavigate('receipts')}
          />
        </RouteGuard>
      )}

      {currentView === 'create-receipt' && (
        <RouteGuard view="create-receipt" role={user.role}>
          <CreateReceiptPage
            onSaved={handleSavedReceipt}
            onCancel={() => handleNavigate('receipts')}
          />
        </RouteGuard>
      )}

      {currentView === 'stock-card' && (
        <RouteGuard view="stock-card" role={user.role}>
          <StockCardPage />
        </RouteGuard>
      )}

      {currentView === 'chart-of-accounts' && (
        <RouteGuard view="chart-of-accounts" role={user.role}>
          <ChartOfAccountsPage />
        </RouteGuard>
      )}

      {currentView === 'accounting-periods' && (
        <RouteGuard view="accounting-periods" role={user.role}>
          <AccountingPeriodsPage />
        </RouteGuard>
      )}

      {currentView === 'trial-balance' && (
        <RouteGuard view="trial-balance" role={user.role}>
          <TrialBalancePage />
        </RouteGuard>
      )}

      {currentView === 'audit-trail' && (
        <RouteGuard view="audit-trail" role={user.role}>
          <AuditTrailPage />
        </RouteGuard>
      )}
    </MainLayout>
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

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LocaleProvider, useLocale } from './hooks/useLocale';
import { MainLayout } from './layouts/MainLayout';
import { RouteGuard } from './components/RouteGuard';
import { ROUTES } from './routes';
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

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  const handleSavedReceipt = (receipt: { id: string; receiptNumber?: string }) => {
    setNotification({
      type: 'success',
      message: `${t.receipts.createdSuccess} (${receipt.receiptNumber || receipt.id})`,
    });
  };

  const handleReceiptDeleted = () => {
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
      notification={notification}
      onDismissNotification={() => setNotification(null)}
    >
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.RECEIPTS} replace />} />

        {/* Inventory Views */}
        <Route
          path={ROUTES.RECEIPTS}
          element={
            <RouteGuard view="receipts" role={user.role}>
              <ReceiptsPage
                subView="list"
                onSavedReceipt={handleSavedReceipt}
                onReceiptDeleted={handleReceiptDeleted}
              />
            </RouteGuard>
          }
        />
        <Route
          path={ROUTES.CREATE_RECEIPT}
          element={
            <RouteGuard view="create-receipt" role={user.role}>
              <CreateReceiptPage onSaved={handleSavedReceipt} />
            </RouteGuard>
          }
        />
        <Route
          path={ROUTES.RECEIPT_DETAILS}
          element={
            <RouteGuard view="receipt-details" role={user.role}>
              <ReceiptsPage
                subView="details"
                onSavedReceipt={handleSavedReceipt}
                onReceiptDeleted={handleReceiptDeleted}
              />
            </RouteGuard>
          }
        />
        <Route
          path={ROUTES.EDIT_RECEIPT}
          element={
            <RouteGuard view="edit-receipt" role={user.role}>
              <ReceiptsPage
                subView="edit"
                onSavedReceipt={handleSavedReceipt}
              />
            </RouteGuard>
          }
        />
        <Route
          path={ROUTES.STOCK_CARD}
          element={
            <RouteGuard view="stock-card" role={user.role}>
              <StockCardPage />
            </RouteGuard>
          }
        />

        {/* Finance Views */}
        <Route
          path={ROUTES.CHART_OF_ACCOUNTS}
          element={
            <RouteGuard view="chart-of-accounts" role={user.role}>
              <ChartOfAccountsPage />
            </RouteGuard>
          }
        />
        <Route
          path={ROUTES.ACCOUNTING_PERIODS}
          element={
            <RouteGuard view="accounting-periods" role={user.role}>
              <AccountingPeriodsPage />
            </RouteGuard>
          }
        />
        <Route
          path={ROUTES.TRIAL_BALANCE}
          element={
            <RouteGuard view="trial-balance" role={user.role}>
              <TrialBalancePage />
            </RouteGuard>
          }
        />

        {/* System Views */}
        <Route
          path={ROUTES.AUDIT_TRAIL}
          element={
            <RouteGuard view="audit-trail" role={user.role}>
              <AuditTrailPage />
            </RouteGuard>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.RECEIPTS} replace />} />
      </Routes>
    </MainLayout>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
};

export default App;

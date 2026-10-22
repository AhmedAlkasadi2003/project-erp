import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { Navbar, AppView } from './components/layout/Navbar';
import { LoginForm } from './components/auth/LoginForm';
import { ReceiptList } from './components/receipts/ReceiptList';
import { ReceiptForm } from './components/receipts/ReceiptForm';
import { ReceiptDetails } from './components/receipts/ReceiptDetails';
import { SystemHealth } from './components/system/SystemHealth';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { locale, setLocale } = useLocale();

  const [currentView, setCurrentView] = useState<AppView>('receipts');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const handleNavigate = (view: AppView) => {
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

  const handleSavedReceipt = (receipt: { id: string }) => {
    setSelectedReceiptId(receipt.id);
    setCurrentView('receipt-details');
  };

  return (
    <div className="app-layout">
      {isAuthenticated && user ? (
        <>
          <Navbar currentView={currentView} onNavigate={handleNavigate} />
          <main className="app-main-content">
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
                onReceiptDeleted={() => handleNavigate('receipts')}
              />
            )}
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
            <section className="status-card" aria-label="Infrastructure Status">
              <SystemHealth />
            </section>
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

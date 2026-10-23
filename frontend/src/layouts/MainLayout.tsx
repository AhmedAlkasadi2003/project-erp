import React from 'react';
import { Navbar } from './Navbar';
import { AppView } from '../types';
import { Alert } from '../components/Alert';

interface MainLayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  notification: { type: 'success' | 'error' | 'warning' | 'info'; message: string } | null;
  onDismissNotification: () => void;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  currentView,
  onNavigate,
  notification,
  onDismissNotification,
  children,
}) => {
  return (
    <div className="app-layout">
      <Navbar currentView={currentView} onNavigate={onNavigate} />
      <main className="app-main-content">
        {notification && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Alert
              type={notification.type}
              message={notification.message}
              onClose={onDismissNotification}
            />
          </div>
        )}
        {children}
      </main>
    </div>
  );
};

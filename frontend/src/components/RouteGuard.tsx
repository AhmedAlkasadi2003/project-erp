import React from 'react';
import { AppView, UserRole } from '../types';
import { canUserAccessView } from '../routes';

interface RouteGuardProps {
  view: AppView;
  role: UserRole | undefined;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * RouteGuard acts as the authoritative frontend route middleware.
 * It ensures that views are only rendered if the user's role satisfies access requirements.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({
  view,
  role,
  children,
  fallback = null,
}) => {
  const isAllowed = canUserAccessView(role, view);

  if (!isAllowed) {
    return (
      fallback || (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
          <h2 style={{ color: 'var(--color-danger, #e53e3e)', marginBottom: '0.75rem' }}>
            403 — غير مصرح لك بالوصول (Access Forbidden)
          </h2>
          <p style={{ color: 'var(--color-text-secondary, #718096)' }}>
            ليس لديك الصلاحيات الكافية للوصول إلى هذه الشاشة. يرجى مراجعة مسؤول النظام.
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
};

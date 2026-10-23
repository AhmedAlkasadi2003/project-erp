import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthContextType, Company, LoginCredentials, User } from '../types';
import * as authApi from '../services/auth';
import { getStoredToken, setOnUnauthorizedCallback, setStoredToken } from '../services/client';

export type { AuthContextType };

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setCompany(null);
    setError(null);
  }, []);

  const initAuth = useCallback(async () => {
    const activeToken = getStoredToken();
    if (!activeToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const currentUser = await authApi.getMe();
      setUser(currentUser);

      try {
        const currentCompany = await authApi.getCurrentCompany();
        setCompany(currentCompany);
      } catch {
        // If company load fails, keep user info
      }
    } catch {
      // Token expired or invalid
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      logout();
    });

    void initAuth();
  }, [initAuth, logout]);

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(credentials);
      setStoredToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);

      try {
        const currentCompany = await authApi.getCurrentCompany();
        setCompany(currentCompany);
      } catch {
        // Ignore company fetch error if any
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

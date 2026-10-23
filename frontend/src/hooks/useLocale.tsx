import React, { createContext, useContext, useEffect, useState } from 'react';
import { Locale, LocaleContextType } from '../types';
import { translations } from '../i18n';

export type { LocaleContextType };

export const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem('erp_locale') as Locale;
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {
      // Ignore
    }
    return 'en';
  });

  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('erp_locale', newLocale);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch {
      return String(dateStr);
    }
  };

  const formatCurrency = (amount: string | number | null | undefined, currency = 'USD'): string => {
    if (amount === null || amount === undefined || amount === '') return '0.0000';
    try {
      const num = typeof amount === 'number' ? amount : parseFloat(amount);
      if (isNaN(num)) return String(amount);
      return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(num);
    } catch {
      return `${amount} ${currency}`;
    }
  };

  const formatQuantity = (qty: string | number | null | undefined): string => {
    if (qty === null || qty === undefined || qty === '') return '0.0000';
    try {
      const num = typeof qty === 'number' ? qty : parseFloat(qty);
      if (isNaN(num)) return String(qty);
      return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(num);
    } catch {
      return String(qty);
    }
  };

  return (
    <LocaleContext.Provider
      value={{
        locale,
        dir,
        setLocale,
        t: translations[locale],
        formatDate,
        formatCurrency,
        formatQuantity,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
};

export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

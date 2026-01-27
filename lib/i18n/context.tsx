'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import en from './locales/en';
import zh from './locales/zh';

type Locale = 'en' | 'zh';

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object
      ? `${K}.${NestedKeyOf<T[K]>}`
      : K
    }[keyof T & string]
  : never;

type TranslationKey = NestedKeyOf<typeof zh>;

const translations = { en, zh } as const;

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'ai-benchmark-locale';

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en';
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    }
  }, [locale, mounted]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = translations[locale];
    let value = getNestedValue(dict, key);

    if (value === undefined) {
      // Fallback to English
      value = getNestedValue(translations.en, key);
    }

    if (value === undefined) {
      console.warn(`Missing translation key: ${key}`);
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
      });
    }

    return value;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

'use client';

// English, French and Kinyarwanda (SRS NFR-UX.1). Add a language by adding a column to each
// messages file; nothing else changes. The chosen locale is also sent to the API as
// Accept-Language so the backend can localise emails, certificates and errors.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setRequestLocale } from '../api/http';
import { setDateLocale } from '../format';
import { messages } from './messages';

export type Locale = 'en' | 'fr' | 'rw';
export const locales: { id: Locale; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'rw', label: 'Ikinyarwanda', short: 'RW' },
];

type Vars = Record<string, string | number>;
interface I18nValue { locale: Locale; setLocale: (l: Locale) => void; t: (key: string, vars?: Vars) => string }

const I18nContext = createContext<I18nValue | null>(null);
const KEY = 'spa-locale';

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Locale | null;
      if (saved === 'en' || saved === 'fr' || saved === 'rw') { setDateLocale(saved); setLocaleState(saved); }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    setRequestLocale(locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setDateLocale(l);
    setLocaleState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }, []);

  const t = useCallback((key: string, vars?: Vars) => {
    const entry = messages[key];
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key "${key}"`);
      return key;
    }
    return fill(entry[locale] ?? entry.en, vars);
  }, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export const useT = () => useI18n().t;

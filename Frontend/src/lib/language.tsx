import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'hi' | 'mr';

/**
 * Every language the site can be switched to, in the order they appear in the picker.
 * Marathi ('mr') is disabled here for now, not removed — the translated strings are still written
 * throughout the app via `t(en, hi, mr)`; they just sit unused until 'mr' is added back below and
 * to `isLang`. Re-enabling is exactly reverting that.
 */
export const LANGUAGES: { code: Lang; nativeLabel: string }[] = [
  { code: 'en', nativeLabel: 'English' },
  { code: 'hi', nativeLabel: 'हिन्दी' },
];

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLang(v: string | null): v is Lang {
  // Deliberately not 'mr' here too — see the note on LANGUAGES above. Anyone with 'mr' already
  // saved from before falls back to English rather than landing on a language the picker no longer offers.
  return v === 'en' || v === 'hi';
}

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem('lang');
    if (isLang(stored)) return stored;
  } catch {
    // private browsing, etc. — default to English
  }
  return 'en';
}

/** Holds the active UI language and persists it, same pattern as the theme toggle. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('lang', lang); } catch { /* private browsing, etc. */ }
  }, [lang]);
  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

/**
 * t('English copy', 'हिंदी copy', 'मराठी copy') — returns whichever variant matches the active
 * language, falling back to English when no translation has been written for that string yet.
 * Adding a language later just means adding a 4th argument at each call site that needs it —
 * nothing here has to change.
 */
export function useT() {
  const { lang } = useLanguage();
  return (en: string, hi?: string, mr?: string): string => {
    if (lang === 'hi' && hi) return hi;
    if (lang === 'mr' && mr) return mr;
    return en;
  };
}

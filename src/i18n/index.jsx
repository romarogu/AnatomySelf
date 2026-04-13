import { createContext, useContext, useState, useCallback } from "react";
import en from "./en.json";
import zh from "./zh.json";

const langs = { en, zh };

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    // Default: check browser language, fallback to English
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem('as_lang');
    if (saved && langs[saved]) return saved;
    const nav = typeof navigator !== 'undefined' && navigator.language;
    return nav && nav.startsWith('zh') ? 'zh' : 'en';
  });

  const toggleLang = useCallback(() => {
    setLocale(prev => {
      const next = prev === 'en' ? 'zh' : 'en';
      try { localStorage.setItem('as_lang', next); } catch {}
      return next;
    });
  }, []);

  const setLang = useCallback((lang) => {
    if (langs[lang]) {
      setLocale(lang);
      try { localStorage.setItem('as_lang', lang); } catch {}
    }
  }, []);

  const t = useCallback((path, params) => {
    const keys = path.split('.');
    let val = langs[locale];
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) val = val[k];
      else return path; // fallback: return key path
    }
    if (typeof val === 'string' && params) {
      return val.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    }
    return val ?? path;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t, toggleLang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

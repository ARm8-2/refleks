import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEYS } from "../storageKeys";
import {
  applyLocale,
  LOCALES,
  resolveLocale,
  translate,
  type Locale,
  type MessageKey,
  type MessageParams,
} from "./core";

export * from "./core";
export * from "./errors";
export { plural } from "./plural";

/**
 * Detect a supported locale from the browser/OS language tag
 * (e.g. "nl-NL" -> "nl", "zh-TW" -> "zh-TW"). Falls back to the default
 * locale. See `resolveLocale` for the matching rules.
 */
export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return resolveLocale(navigator.language);
}

/** Locale to use on startup: persisted choice, else system detection. */
export function getSavedLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEYS.language);
  if (isLocaleLike(saved)) return saved as Locale;
  return detectSystemLocale();
}

function isLocaleLike(value: string | null): boolean {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a catalog key; re-renders the consumer on locale change. */
  t: (key: MessageKey, params?: MessageParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
export { I18nContext };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = getSavedLocale();
    applyLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next: Locale) => {
    applyLocale(next);
    try {
      localStorage.setItem(STORAGE_KEYS.language, next);
    } catch {
      /* ignore quota errors */
    }
    setLocaleState(next);
  }, []);

  // Keep `<html lang>` aligned (also set synchronously by applyLocale).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: translate }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

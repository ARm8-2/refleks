import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { type AppLanguage, isAppLanguage } from "./locale";
import { resources } from "./resources";
import { setActiveLocale } from "./format";

export * from "./locale";
export * from "./format";
export * from "./useLocaleFormat";
export * from "./messages";

export function setDocumentLanguage(language: AppLanguage): void {
  document.documentElement.lang = language;
}

export async function initializeI18n(language: AppLanguage): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: "en",
      defaultNS: "common",
      returnNull: false,
      interpolation: { escapeValue: false },
      react: {
        transSupportBasicHtmlNodes: false,
        transKeepBasicHtmlNodesFor: [],
      },
    });
  } else if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  setActiveLocale(language);
  setDocumentLanguage(language);
}

export async function changeAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  setActiveLocale(language);
  setDocumentLanguage(language);
}

export function currentAppLanguage(): AppLanguage {
  return isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
}

export { i18n };

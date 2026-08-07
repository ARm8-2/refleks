export const SUPPORTED_LANGUAGES = ["en", "zh-CN"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type IntlLocale = "en-US" | "zh-CN";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function detectInitialLanguage(systemLanguage: string): AppLanguage {
  const primaryLanguage = systemLanguage.trim().split(/[-_]/, 1)[0]?.toLowerCase();
  return primaryLanguage === "zh" ? "zh-CN" : "en";
}

export function toIntlLocale(language: AppLanguage): IntlLocale {
  return language === "zh-CN" ? "zh-CN" : "en-US";
}

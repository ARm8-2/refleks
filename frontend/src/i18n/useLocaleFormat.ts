import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createLocaleFormatters } from "./format";
import { isAppLanguage } from "./locale";

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const language = isAppLanguage(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : "en";
  return useMemo(() => createLocaleFormatters(language), [language]);
}

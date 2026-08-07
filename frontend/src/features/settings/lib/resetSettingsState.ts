import { isAppLanguage, type AppLanguage } from "@/i18n";
import type { Settings } from "@/shared/types";

export function preserveLanguageAfterReset(
  reloaded: Settings,
  committed: Settings,
  fallback: AppLanguage,
): Settings {
  const language = isAppLanguage(reloaded.language)
    ? reloaded.language
    : isAppLanguage(committed.language)
      ? committed.language
      : fallback;
  return { ...reloaded, language };
}

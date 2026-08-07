import type { Settings } from "@/shared/types";
import {
  detectInitialLanguage,
  type AppLanguage,
  isAppLanguage,
} from "./locale";

interface StartupLanguageDependencies {
  readSettings: () => Promise<Settings>;
  writeSettings: (settings: Settings) => Promise<void>;
  getSystemLanguage: () => string;
  logError?: (message: string, error: unknown) => void;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`Settings read timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function resolveStartupLanguage({
  readSettings,
  writeSettings,
  getSystemLanguage,
  logError = (message, error) => console.error(message, error),
  timeoutMs = 1_000,
}: StartupLanguageDependencies): Promise<AppLanguage> {
  let settings: Settings;
  try {
    settings = await withTimeout(readSettings(), timeoutMs);
  } catch (error) {
    logError("Unable to read Settings before localization startup", error);
    return "en";
  }

  if (isAppLanguage(settings.language)) return settings.language;

  const detected = detectInitialLanguage(getSystemLanguage());
  try {
    await writeSettings({ ...settings, language: detected });
  } catch (error) {
    logError("Unable to persist the initially detected language", error);
  }
  return detected;
}

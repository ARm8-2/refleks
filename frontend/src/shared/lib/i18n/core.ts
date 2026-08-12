import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";
import type { MessageValue } from "./messages/types";

/**
 * Registered locales. Adding a language means adding an entry here plus a
 * matching catalog folder under `messages/<locale>`. Entries are full BCP 47
 * style tags; use region/script variants only when the content actually
 * differs (e.g. `zh-CN` Simplified vs `zh-TW` Traditional — English and
 * Dutch share one catalog each, so `en` / `nl` suffice).
 */
export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGS: Record<Locale, Messages> = { en, nl };

const DEFAULT_LOCALE: Locale = "en";

/**
 * Alias table for resolving tags to a registered variant of the same
 * language. Keys are normalized (lowercase, `-` separators). Only consulted
 * when the base language has multiple registered variants — add entries here
 * when you register region/script variants (e.g. for Chinese):
 *
 *   "zh": "zh-CN",      // unqualified zh defaults to Simplified
 *   "zh-cn": "zh-CN", "zh-sg": "zh-CN", "zh-hans": "zh-CN",
 *   "zh-tw": "zh-TW", "zh-hk": "zh-TW", "zh-mo": "zh-TW", "zh-hant": "zh-TW",
 */
const LOCALE_ALIASES: Readonly<Record<string, string>> = {};

/**
 * Resolve a browser/OS language tag to the closest supported locale:
 * exact tag first, then the base language (when it maps to a single
 * variant), then the alias table, then the default. This lets region tags
 * like `nl-NL` or `zh-HK` resolve gracefully.
 */
export function resolveLocale(tag: string | null | undefined): Locale {
  if (typeof tag !== "string") return DEFAULT_LOCALE;
  const normalized = tag.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) return DEFAULT_LOCALE;

  // 1. Exact tag match.
  if (isLocaleLike(normalized)) return normalized as Locale;

  // 2. Base language only, if it maps to exactly one registered variant.
  const base = normalized.split("-")[0];
  const baseVariants = (LOCALES as readonly string[]).filter(
    (locale) => locale.split("-")[0] === base,
  );
  if (baseVariants.length === 1) return baseVariants[0] as Locale;
  if (baseVariants.length > 1) {
    // 3. Region/script aliases disambiguate multi-variant languages.
    const aliased = LOCALE_ALIASES[normalized] ?? LOCALE_ALIASES[base];
    if (aliased && isLocaleLike(aliased)) return aliased as Locale;
  }

  // 4. Fall back to the default locale.
  return DEFAULT_LOCALE;
}

export type MessageParams = Record<string, string | number>;

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends MessageValue
    ? K
    : T[K] extends (...args: never[]) => unknown
      ? never
      : T[K] extends readonly unknown[]
        ? `${K}.${Extract<keyof T[K], `${number}`>}`
        : T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : never;
}[keyof T & string];

/** Dotted message keys, e.g. `common.actions.cancel` — type-checked against the catalog. */
export type MessageKey = NestedKeyOf<Messages>;

let currentLocale: Locale = "en";
let currentMessages: Messages = en;

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly string[]).includes(value as string);
}

function isLocaleLike(value: string): boolean {
  return (LOCALES as readonly string[]).includes(value);
}

/** Current active locale. Use in non-React code (e.g. Intl formatters). */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Switches the active locale for the framework-free translator and keeps
 * `<html lang>` in sync. React components should prefer `setLocale` from
 * `useI18n()`; this is for bootstrapping and non-React call sites.
 */
export function applyLocale(locale: Locale) {
  currentLocale = locale;
  currentMessages = CATALOGS[locale];
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

function lookup(messages: Messages, key: string): MessageValue | undefined {
  let value: unknown = messages;
  for (const part of key.split(".")) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value as MessageValue | undefined;
}

/**
 * Resolve a message key in the active locale, falling back to the English
 * reference catalog (then the key itself) when missing. Function values are
 * invoked with `params.count`; `{param}` placeholders are substituted from
 * `params`.
 */
export function translate(key: MessageKey, params?: MessageParams): string {
  let value = lookup(currentMessages, key);
  if (typeof value !== "string" && typeof value !== "function") {
    value = lookup(en, key);
  }
  if (typeof value === "function") {
    const count = typeof params?.count === "number" ? params.count : 0;
    value = value(count);
  }
  if (typeof value !== "string") return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) => {
    const replacement = params[name];
    return replacement === undefined ? match : String(replacement);
  });
}

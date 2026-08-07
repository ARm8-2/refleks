import { type AppLanguage, toIntlLocale } from "./locale";

type DateInput = Date | number | string;
type DurationUnit = "hour" | "minute" | "second";

let activeLanguage: AppLanguage = "en";
let activeFormatters: LocaleFormatters | null = null;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function createLocaleFormatters(language: AppLanguage) {
  const locale = toIntlLocale(language);
  const dateTimeCache = new Map<string, Intl.DateTimeFormat>();
  const numberCache = new Map<string, Intl.NumberFormat>();
  const pluralCache = new Map<string, Intl.PluralRules>();
  const collatorCache = new Map<string, Intl.Collator>();

  function dateTimeFormatter(options: Intl.DateTimeFormatOptions = {}) {
    const key = JSON.stringify(options);
    let formatter = dateTimeCache.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, options);
      dateTimeCache.set(key, formatter);
    }
    return formatter;
  }

  function numberFormatter(options: Intl.NumberFormatOptions = {}) {
    const key = JSON.stringify(options);
    let formatter = numberCache.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options);
      numberCache.set(key, formatter);
    }
    return formatter;
  }

  function pluralRules(options: Intl.PluralRulesOptions = {}) {
    const key = JSON.stringify(options);
    let formatter = pluralCache.get(key);
    if (!formatter) {
      formatter = new Intl.PluralRules(locale, options);
      pluralCache.set(key, formatter);
    }
    return formatter;
  }

  function collator(options: Intl.CollatorOptions = {}) {
    const key = JSON.stringify(options);
    let formatter = collatorCache.get(key);
    if (!formatter) {
      formatter = new Intl.Collator(locale, options);
      collatorCache.set(key, formatter);
    }
    return formatter;
  }

  function formatDuration(totalSeconds: number): string {
    const rounded = Math.round(totalSeconds);
    const sign = rounded < 0 ? "-" : "";
    let remaining = Math.abs(rounded);
    const units: Array<[DurationUnit, number]> = [
      ["hour", Math.floor(remaining / 3600)],
      ["minute", Math.floor((remaining % 3600) / 60)],
      ["second", remaining % 60],
    ];
    const visible = units.filter(([, value]) => value > 0);
    const parts: Array<[DurationUnit, number]> = (
      visible.length ? visible : [["second", 0]]
    ).slice(0, 2) as Array<[DurationUnit, number]>;
    return (
      sign +
      parts
        .map(([unit, value]) =>
          numberFormatter({ style: "unit", unit, unitDisplay: "short" }).format(
            value as number,
          ),
        )
        .join(" ")
    );
  }

  return {
    language,
    locale,
    dateTimeFormatter,
    numberFormatter,
    pluralRules,
    collator,
    formatDate: (value: DateInput, options: Intl.DateTimeFormatOptions = {}) =>
      dateTimeFormatter(options).format(toDate(value)),
    formatNumber: (value: number, options: Intl.NumberFormatOptions = {}) =>
      numberFormatter(options).format(value),
    formatDuration,
    formatWeekday: (
      value: DateInput,
      weekday: Intl.DateTimeFormatOptions["weekday"] = "short",
      timeZone?: string,
    ) => dateTimeFormatter({ weekday, timeZone }).format(toDate(value)),
    formatMonth: (
      value: DateInput,
      month: Intl.DateTimeFormatOptions["month"] = "short",
      timeZone?: string,
    ) => dateTimeFormatter({ month, timeZone }).format(toDate(value)),
    selectPlural: (value: number, options: Intl.PluralRulesOptions = {}) =>
      pluralRules(options).select(value),
    compareLabels: (left: string, right: string, options: Intl.CollatorOptions = {}) =>
      collator(options).compare(left, right),
  };
}

export type LocaleFormatters = ReturnType<typeof createLocaleFormatters>;

export function setActiveLocale(language: AppLanguage): void {
  activeLanguage = language;
  activeFormatters = null;
}

export function getActiveLocaleFormatters(): LocaleFormatters {
  activeFormatters ??= createLocaleFormatters(activeLanguage);
  return activeFormatters;
}

import { useStore } from "@/shared/hooks";
import { getLocale, translate } from "@/shared/lib/i18n";
import { useMemo } from "react";

export type DailyPlaytimePoint = {
  day: string;
  label: string;
  minutes: number;
};

let weekdayFormatterLocale: string | null = null;
let weekdayFormatter: Intl.DateTimeFormat | null = null;
function getWeekdayFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!weekdayFormatter || weekdayFormatterLocale !== locale) {
    weekdayFormatterLocale = locale;
    weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  }
  return weekdayFormatter;
}

export function useDailyPlaytime(days = 7): DailyPlaytimePoint[] {
  const sessions = useStore((state) => state.sessions);
  const locale = getLocale();

  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayBuckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayBuckets.set(toDayKey(d), 0);
    }

    for (const session of sessions) {
      for (const item of session.items) {
        const raw = item.stats?.summary.datePlayed;
        if (!raw) continue;
        const ts = Date.parse(String(raw));
        if (!Number.isFinite(ts)) continue;

        const key = toDayKey(new Date(ts));
        const existing = dayBuckets.get(key);
        if (existing === undefined) continue;

        const seconds = Number(item.stats?.summary.duration ?? 0);
        if (!Number.isFinite(seconds) || seconds <= 0) continue;
        dayBuckets.set(key, existing + seconds / 60);
      }
    }

    const result: DailyPlaytimePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toDayKey(d);
      result.push({
        day: key,
        label:
          i === 0
            ? translate("overview.dailyPlaytime.today")
            : getWeekdayFormatter().format(d),
        minutes: Math.round(dayBuckets.get(key) ?? 0),
      });
    }

    return result;
  }, [days, sessions, locale]);
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

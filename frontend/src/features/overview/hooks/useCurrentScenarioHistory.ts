import { getScenarioName } from "@/features/benchmarks/lib/detailFormatting";
import { getActiveLocaleFormatters } from "@/i18n";
import { useStore } from "@/shared/hooks";
import type { RunRecord } from "@/shared/types";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const shortDateOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};
const dateTimeOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export type TrendPoint = {
  label: string;
  fullLabel: string;
  score: number;
};

type CurrentScenarioHistory = {
  currentScenarioName: string | null;
  sessionAveragePoints: TrendPoint[];
  attemptPoints: TrendPoint[];
};

export function useCurrentScenarioHistory(): CurrentScenarioHistory {
  const { t } = useTranslation("overview");
  const sessions = useStore((state) => state.sessions);

  return useMemo(() => {
    let currentScenarioName: string | null = null;

    for (const session of sessions) {
      for (const item of session.items) {
        const name = getScenarioName(item).trim();
        if (name) {
          currentScenarioName = name;
          break;
        }
      }

      if (currentScenarioName) break;
    }

    if (!currentScenarioName) {
      return {
        currentScenarioName: null,
        sessionAveragePoints: [],
        attemptPoints: [],
      };
    }

    const sessionAveragePoints: TrendPoint[] = [];
    const attemptPoints: TrendPoint[] = [];
    const orderedSessions = [...sessions].reverse();

    for (const session of orderedSessions) {
      const matchingItems = [...session.items]
        .reverse()
        .filter((item) => getScenarioName(item).trim() === currentScenarioName);

      if (matchingItems.length === 0) continue;

      const scores = matchingItems.map(readRunScore);
      const averageScore =
        scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const sessionTs = Math.max(...matchingItems.map(readRunTimestamp));
      const shortLabel = formatShortDate(
        sessionTs,
        sessionAveragePoints.length + 1,
        t,
      );
      const fullLabel = formatSessionLabel(
        session.start,
        session.end,
        scores.length,
        t,
      );

      sessionAveragePoints.push({
        label: shortLabel,
        fullLabel,
        score: Number(averageScore.toFixed(1)),
      });

      for (const item of matchingItems) {
        const score = readRunScore(item);
        const timestamp = readRunTimestamp(item);
        const nextIndex = attemptPoints.length + 1;

        attemptPoints.push({
          label: String(nextIndex),
          fullLabel: formatAttemptLabel(timestamp, nextIndex, t),
          score,
        });
      }
    }

    return {
      currentScenarioName,
      sessionAveragePoints,
      attemptPoints,
    };
  }, [sessions, t]);
}

function readRunScore(item: Pick<RunRecord, "stats">): number {
  const score = Number(item.stats?.summary.score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function readRunTimestamp(item: Pick<RunRecord, "stats">): number {
  const raw = item.stats?.summary.datePlayed;
  if (!raw) return 0;

  const timestamp = Date.parse(String(raw));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatShortDate(
  timestamp: number,
  fallbackIndex: number,
  t: TFunction<"overview">,
): string {
  if (timestamp <= 0) return t("history.sessionShort", { index: fallbackIndex });
  return getActiveLocaleFormatters().dateTimeFormatter(shortDateOptions).format(new Date(timestamp));
}

function formatAttemptLabel(
  timestamp: number,
  attemptIndex: number,
  t: TFunction<"overview">,
): string {
  if (timestamp <= 0) return t("history.attempt", { index: attemptIndex });
  return t("history.attemptWithDate", {
    index: attemptIndex,
    date: getActiveLocaleFormatters()
      .dateTimeFormatter(dateTimeOptions)
      .format(new Date(timestamp)),
  });
}

function formatSessionLabel(
  start: string,
  end: string,
  attempts: number,
  t: TFunction<"overview">,
): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return formatRunCount(attempts, t);
  }

  const formatter = getActiveLocaleFormatters().dateTimeFormatter(dateTimeOptions);
  return t("history.sessionRange", {
    start: formatter.format(startDate),
    end: formatter.format(endDate),
    runs: formatRunCount(attempts, t),
  });
}

function formatRunCount(
  count: number,
  t: TFunction<"overview">,
): string {
  return count === 1
    ? t("history.run_one", { count })
    : t("history.run_other", { count });
}

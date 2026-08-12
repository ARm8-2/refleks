import {
  getLocale,
  getScenarioName,
  readRunAccuracy,
  readRunDurationMs,
  readRunScore,
  readRunTimestamp,
  translate,
  type MessageKey,
} from "@/shared/lib";
import type { RunRecord, Session, StatKey } from "@/shared/types";

// Intl formatters are cached per locale so hot paths (e.g. one call per table
// cell) never rebuild a formatter per invocation.
let sessionFormatterLocale: string | null = null;
let sessionFormatter: Intl.DateTimeFormat | null = null;
function getSessionFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!sessionFormatter || sessionFormatterLocale !== locale) {
    sessionFormatterLocale = locale;
    sessionFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return sessionFormatter;
}

let compactDateLocale: string | null = null;
let compactDateFormatter: Intl.DateTimeFormat | null = null;
function getCompactDateFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!compactDateFormatter || compactDateLocale !== locale) {
    compactDateLocale = locale;
    compactDateFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    });
  }
  return compactDateFormatter;
}

let timeFormatterLocale: string | null = null;
let timeFormatter: Intl.DateTimeFormat | null = null;
function getTimeFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!timeFormatter || timeFormatterLocale !== locale) {
    timeFormatterLocale = locale;
    timeFormatter = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return timeFormatter;
}

let numberFormatterLocale: string | null = null;
let numberFormatter: Intl.NumberFormat | null = null;
function getNumberFormatter(): Intl.NumberFormat {
  const locale = getLocale();
  if (!numberFormatter || numberFormatterLocale !== locale) {
    numberFormatterLocale = locale;
    numberFormatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    });
  }
  return numberFormatter;
}

let preciseNumberFormatterLocale: string | null = null;
let preciseNumberFormatter: Intl.NumberFormat | null = null;
function getPreciseNumberFormatter(): Intl.NumberFormat {
  const locale = getLocale();
  if (!preciseNumberFormatter || preciseNumberFormatterLocale !== locale) {
    preciseNumberFormatterLocale = locale;
    preciseNumberFormatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    });
  }
  return preciseNumberFormatter;
}

const arbitraryPrecisionFormatters = new Map<string, Intl.NumberFormat>();
function getArbitraryPrecisionFormatter(decimals: number): Intl.NumberFormat {
  const locale = getLocale();
  const key = `${locale}:${decimals}`;
  let formatter = arbitraryPrecisionFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    arbitraryPrecisionFormatters.set(key, formatter);
  }
  return formatter;
}

export type HistoryRun = {
  id: string;
  sessionId: string;
  session: Session;
  item: RunRecord;
  scenarioName: string;
  playedAt: number;
  score: number;
  accuracy: number | null;
  durationMs: number;
  orderInSession: number;
};

type RunStatFieldDefinition = {
  key: StatKey;
  labelKey: MessageKey;
  categoryKey: MessageKey;
};

const RUN_STAT_FIELDS: RunStatFieldDefinition[] = [
  {
    key: "score",
    labelKey: "history.runStat.score",
    categoryKey: "history.statsCategory.overview",
  },
  {
    key: "kills",
    labelKey: "history.runStat.kills",
    categoryKey: "history.statsCategory.overview",
  },
  {
    key: "hitCount",
    labelKey: "history.runStat.hitCount",
    categoryKey: "history.statsCategory.overview",
  },
  {
    key: "accuracy",
    labelKey: "history.runStat.accuracy",
    categoryKey: "history.statsCategory.overview",
  },
  {
    key: "missCount",
    labelKey: "history.runStat.missCount",
    categoryKey: "history.statsCategory.accuracyDetails",
  },
  {
    key: "totalOvershots",
    labelKey: "history.runStat.totalOvershots",
    categoryKey: "history.statsCategory.accuracyDetails",
  },
  {
    key: "damageDone",
    labelKey: "history.runStat.damageDone",
    categoryKey: "history.statsCategory.accuracyDetails",
  },
  {
    key: "damageTaken",
    labelKey: "history.runStat.damageTaken",
    categoryKey: "history.statsCategory.accuracyDetails",
  },
  {
    key: "fightTime",
    labelKey: "history.runStat.fightTime",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "timeRemaining",
    labelKey: "history.runStat.timeRemaining",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "avgTtk",
    labelKey: "history.runStat.avgTtk",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "realAvgTtk",
    labelKey: "history.runStat.realAvgTtk",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "pauseCount",
    labelKey: "history.runStat.pauseCount",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "pauseDuration",
    labelKey: "history.runStat.pauseDuration",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "challengeStart",
    labelKey: "history.runStat.challengeStart",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "duration",
    labelKey: "history.runStat.duration",
    categoryKey: "history.statsCategory.timing",
  },
  {
    key: "sensScale",
    labelKey: "history.runStat.sensScale",
    categoryKey: "history.statsCategory.controls",
  },
  {
    key: "sensIncrement",
    labelKey: "history.runStat.sensIncrement",
    categoryKey: "history.statsCategory.controls",
  },
  {
    key: "horizSens",
    labelKey: "history.runStat.horizSens",
    categoryKey: "history.statsCategory.controls",
  },
  {
    key: "vertSens",
    labelKey: "history.runStat.vertSens",
    categoryKey: "history.statsCategory.controls",
  },
  {
    key: "dpi",
    labelKey: "history.runStat.dpi",
    categoryKey: "history.statsCategory.controls",
  },
  {
    key: "cm360",
    labelKey: "history.runStat.cm360",
    categoryKey: "history.statsCategory.controls",
  },
  {
    key: "fov",
    labelKey: "history.runStat.fov",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "fovScale",
    labelKey: "history.runStat.fovScale",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "resolution",
    labelKey: "history.runStat.resolution",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "hideGun",
    labelKey: "history.runStat.hideGun",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "crosshair",
    labelKey: "history.runStat.crosshair",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "crosshairScale",
    labelKey: "history.runStat.crosshairScale",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "crosshairColor",
    labelKey: "history.runStat.crosshairColor",
    categoryKey: "history.statsCategory.display",
  },
  {
    key: "inputLag",
    labelKey: "history.runStat.inputLag",
    categoryKey: "history.statsCategory.technical",
  },
  {
    key: "maxFpsConfig",
    labelKey: "history.runStat.maxFpsConfig",
    categoryKey: "history.statsCategory.technical",
  },
  {
    key: "avgFps",
    labelKey: "history.runStat.avgFps",
    categoryKey: "history.statsCategory.technical",
  },
  {
    key: "resolutionScale",
    labelKey: "history.runStat.resolutionScale",
    categoryKey: "history.statsCategory.technical",
  },
  {
    key: "scenario",
    labelKey: "history.runStat.scenario",
    categoryKey: "history.statsCategory.gameInformation",
  },
  {
    key: "hash",
    labelKey: "history.runStat.hash",
    categoryKey: "history.statsCategory.gameInformation",
  },
  {
    key: "gameVersion",
    labelKey: "history.runStat.gameVersion",
    categoryKey: "history.statsCategory.gameInformation",
  },
  {
    key: "datePlayed",
    labelKey: "history.runStat.datePlayed",
    categoryKey: "history.statsCategory.gameInformation",
  },
  {
    key: "distanceTraveled",
    labelKey: "history.runStat.distanceTraveled",
    categoryKey: "history.statsCategory.gameInformation",
  },
  {
    key: "mbsPoints",
    labelKey: "history.runStat.mbsPoints",
    categoryKey: "history.statsCategory.gameInformation",
  },
  {
    key: "midairs",
    labelKey: "history.runStat.midairs",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "midaired",
    labelKey: "history.runStat.midaired",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "directs",
    labelKey: "history.runStat.directs",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "directed",
    labelKey: "history.runStat.directed",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "deaths",
    labelKey: "history.runStat.deaths",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "avgTargetScale",
    labelKey: "history.runStat.avgTargetScale",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "avgTimeDilation",
    labelKey: "history.runStat.avgTimeDilation",
    categoryKey: "history.statsCategory.additionalStats",
  },
  {
    key: "reloads",
    labelKey: "history.runStat.reloads",
    categoryKey: "history.statsCategory.additionalStats",
  },
];

export function buildHistoryRuns(sessions: Session[]): HistoryRun[] {
  return sessions.flatMap((session) =>
    session.items.map((item, index) => ({
      id: item.filePath || `${session.id}:${index}`,
      sessionId: session.id,
      session,
      item,
      scenarioName:
        getScenarioName(item).trim() || translate("history.unknownScenario"),
      playedAt: readRunTimestamp(item),
      score: readRunScore(item),
      accuracy: readRunAccuracy(item),
      durationMs: readRunDurationMs(item),
      orderInSession: index,
    })),
  );
}

export function readSessionStartTimestamp(session: Session): number {
  const start = Date.parse(session.start);
  if (Number.isFinite(start) && start > 0) return start;

  const timestamps = session.items
    .map(readRunTimestamp)
    .filter((timestamp) => timestamp > 0);
  return timestamps.length > 0 ? Math.min(...timestamps) : 0;
}

export function readSessionEndTimestamp(session: Session): number {
  const end = Date.parse(session.end);
  if (Number.isFinite(end) && end > 0) return end;

  const timestamps = session.items
    .map(readRunTimestamp)
    .filter((timestamp) => timestamp > 0);
  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

export function readSessionDurationMs(session: Session): number {
  const start = readSessionStartTimestamp(session);
  const end = readSessionEndTimestamp(session);
  if (start > 0 && end >= start) return end - start;
  return 0;
}

export function readUniqueScenarioCount(session: Session): number {
  return new Set(
    session.items.map((item) => getScenarioName(item).trim()).filter(Boolean),
  ).size;
}

export function readSessionActivePlaytimeMs(session: Session): number {
  return session.items.reduce((sum, item) => sum + readRunDurationMs(item), 0);
}

export function readSessionAverageScore(session: Session): number {
  const scores = session.items.map(readRunScore).filter((score) => score > 0);
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function readTopRepeatedScenario(
  session: Session,
): { name: string; attempts: number } | null {
  const counts = new Map<string, number>();

  for (const item of session.items) {
    const name = getScenarioName(item).trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  let result: { name: string; attempts: number } | null = null;
  for (const [name, attempts] of counts) {
    if (!result || attempts > result.attempts) {
      result = { name, attempts };
    }
  }

  return result;
}

export type ScenarioSummary = {
  name: string;
  count: number;
  bestScore: number;
  trend: "up" | "down" | "same" | null;
};

export function buildSessionScenarioSummaries(
  session: Session,
  sessions: Session[],
): ScenarioSummary[] {
  const grouped = new Map<string, RunRecord[]>();
  for (const item of session.items) {
    const name = getScenarioName(item).trim();
    if (!name) continue;
    const list = grouped.get(name) ?? [];
    list.push(item);
    grouped.set(name, list);
  }

  // Find previous session for trend comparison
  const sessionIndex = sessions.findIndex((s) => s.id === session.id);
  const prevSession =
    sessionIndex >= 0 && sessionIndex < sessions.length - 1
      ? sessions[sessionIndex + 1]
      : null;
  const prevBestMap = new Map<string, number>();
  if (prevSession) {
    for (const item of prevSession.items) {
      const name = getScenarioName(item).trim();
      if (!name) continue;
      const score = readRunScore(item);
      const current = prevBestMap.get(name) ?? 0;
      if (score > current) prevBestMap.set(name, score);
    }
  }

  const summaries: ScenarioSummary[] = [];
  for (const [name, items] of grouped) {
    const bestScore = Math.max(...items.map(readRunScore));
    const prevBest = prevBestMap.get(name);
    let trend: "up" | "down" | "same" | null = null;
    if (prevBest != null && bestScore > 0) {
      if (bestScore > prevBest) trend = "up";
      else if (bestScore < prevBest) trend = "down";
      else trend = "same";
    }
    summaries.push({ name, count: items.length, bestScore, trend });
  }

  summaries.sort((a, b) => b.count - a.count);
  return summaries;
}

export type ScenarioTrendPoint = {
  label: string;
  fullLabel: string;
  score: number;
  accuracy: number | null;
  runId: string;
};

export function buildSessionScenarioTrendPoints(
  scenarioName: string,
  runs: HistoryRun[],
): ScenarioTrendPoint[] {
  const scenarioRuns = runs
    .filter((run) => run.scenarioName === scenarioName)
    .slice()
    .reverse();

  return scenarioRuns.map((run, i) => ({
    label:
      run.playedAt > 0
        ? getCompactDateFormatter().format(run.playedAt)
        : `#${i + 1}`,
    fullLabel:
      run.playedAt > 0
        ? getSessionFormatter().format(run.playedAt)
        : translate("history.overview.attempt", { count: i + 1 }),
    score: run.score,
    accuracy: run.accuracy,
    runId: run.id,
  }));
}

export function formatSessionTitle(session: Session): string {
  const customName = session.name?.trim();
  if (customName) return customName;

  const startedAt = readSessionStartTimestamp(session);
  return startedAt > 0
    ? getSessionFormatter().format(startedAt)
    : translate("history.session.untitled");
}

export function formatSessionDateRange(session: Session): string {
  const start = readSessionStartTimestamp(session);
  const end = readSessionEndTimestamp(session);

  if (start <= 0 && end <= 0) return translate("history.session.noTimingData");
  if (start <= 0 || end <= 0)
    return getSessionFormatter().format(Math.max(start, end));

  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay) {
    return translate("history.session.dateRange", {
      start: getSessionFormatter().format(start),
      end: getTimeFormatter().format(end),
    });
  }

  return translate("history.session.dateRange", {
    start: getSessionFormatter().format(start),
    end: getSessionFormatter().format(end),
  });
}

export function formatCompactDate(timestamp: number): string {
  return timestamp > 0 ? getCompactDateFormatter().format(timestamp) : "--";
}

export function formatRunTimestamp(timestamp: number): string {
  return timestamp > 0
    ? getSessionFormatter().format(timestamp)
    : translate("history.session.noTimestamp");
}

export function formatRelativeTime(timestamp: number): string {
  if (timestamp <= 0) return "--";

  const diff = timestamp - Date.now();
  const abs = Math.abs(diff);

  if (abs < 60_000) return translate("history.relativeTime.justNow");
  if (abs < 3_600_000) {
    return translate("history.relativeTime.minutesAgo", {
      count: Math.round(abs / 60_000),
    });
  }
  if (abs < 86_400_000) {
    return translate("history.relativeTime.hoursAgo", {
      count: Math.round(abs / 3_600_000),
    });
  }
  if (abs < 604_800_000) {
    return translate("history.relativeTime.daysAgo", {
      count: Math.round(abs / 86_400_000),
    });
  }

  return translate("history.relativeTime.weeksAgo", {
    count: Math.round(abs / 604_800_000),
  });
}

export function formatDurationLabel(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "--";

  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return getNumberFormatter().format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "--";

  if (decimals <= 0) {
    return getNumberFormatter().format(value);
  }

  return getArbitraryPrecisionFormatter(decimals).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${getPreciseNumberFormatter().format(value)}%`;
}

export function matchSessionSearch(session: Session, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const title = formatSessionTitle(session).toLowerCase();
  if (title.includes(normalized)) return true;

  const range = formatSessionDateRange(session).toLowerCase();
  if (range.includes(normalized)) return true;

  return session.items.some((item) =>
    getScenarioName(item).toLowerCase().includes(normalized),
  );
}

export function matchRunSearch(run: HistoryRun, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    run.scenarioName.toLowerCase().includes(normalized) ||
    run.item.fileName.toLowerCase().includes(normalized) ||
    formatRunTimestamp(run.playedAt).toLowerCase().includes(normalized)
  );
}

export function buildRunStats(
  item: RunRecord,
): Array<{ key: StatKey; label: string; value: string; category: string }> {
  const summary = item.stats?.summary;
  const entries: Array<{
    key: StatKey;
    label: string;
    value: string;
    category: string;
  }> = [];

  for (const field of RUN_STAT_FIELDS) {
    const raw = summary?.[field.key];
    if (raw == null) continue;

    let value = "--";

    if (field.key === "accuracy") {
      value = formatPercent(readRunAccuracy(item));
    } else if (field.key === "duration") {
      value = formatDurationLabel(readRunDurationMs(item));
    } else if (typeof raw === "number") {
      value = formatNumber(raw, Number.isInteger(raw) ? 0 : 2);
    } else if (typeof raw === "boolean") {
      value = raw ? translate("common.yes") : translate("common.no");
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) value = trimmed;
    }

    if (value !== "--") {
      entries.push({
        key: field.key,
        label: translate(field.labelKey),
        value,
        category: translate(field.categoryKey),
      });
    }
  }

  return entries;
}

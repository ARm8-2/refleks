import {
  getScenarioName,
  readRunAccuracy,
  readRunDurationMs,
  readRunScore,
  readRunTimestamp,
} from "@/shared/lib";
import { getActiveLocaleFormatters, i18n } from "@/i18n";
import type { RunRecord, Session, StatKey } from "@/shared/types";

function sessionFormatter() {
  return getActiveLocaleFormatters().dateTimeFormatter({
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactDateFormatter() {
  return getActiveLocaleFormatters().dateTimeFormatter({
    month: "short",
    day: "numeric",
  });
}

function timeFormatter() {
  return getActiveLocaleFormatters().dateTimeFormatter({
    hour: "numeric",
    minute: "2-digit",
  });
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

const CATEGORY_KEYS = {
  overview: "history:stats.categories.overview",
  accuracy: "history:stats.categories.accuracy",
  timing: "history:stats.categories.timing",
  controls: "history:stats.categories.controls",
  display: "history:stats.categories.display",
  technical: "history:stats.categories.technical",
  game: "history:stats.categories.game",
  additional: "history:stats.categories.additional",
} as const;

const RUN_STAT_FIELDS = ([
  ["score", "overview"], ["kills", "overview"], ["hitCount", "overview"],
  ["accuracy", "overview"], ["missCount", "accuracy"],
  ["totalOvershots", "accuracy"], ["damageDone", "accuracy"],
  ["damageTaken", "accuracy"], ["fightTime", "timing"],
  ["timeRemaining", "timing"], ["avgTtk", "timing"],
  ["realAvgTtk", "timing"], ["pauseCount", "timing"],
  ["pauseDuration", "timing"], ["challengeStart", "timing"],
  ["duration", "timing"], ["sensScale", "controls"],
  ["sensIncrement", "controls"], ["horizSens", "controls"],
  ["vertSens", "controls"], ["dpi", "controls"], ["cm360", "controls"],
  ["fov", "display"], ["fovScale", "display"],
  ["resolution", "display"], ["hideGun", "display"],
  ["crosshair", "display"], ["crosshairScale", "display"],
  ["crosshairColor", "display"], ["inputLag", "technical"],
  ["maxFpsConfig", "technical"], ["avgFps", "technical"],
  ["resolutionScale", "technical"], ["scenario", "game"],
  ["hash", "game"], ["gameVersion", "game"], ["datePlayed", "game"],
  ["distanceTraveled", "game"], ["mbsPoints", "game"],
  ["midairs", "additional"], ["midaired", "additional"],
  ["directs", "additional"], ["directed", "additional"],
  ["deaths", "additional"], ["avgTargetScale", "additional"],
  ["avgTimeDilation", "additional"], ["reloads", "additional"],
] as const).map(([key, category]) => ({
  key,
  labelKey: `history:stats.fields.${key}` as const,
  categoryKey: CATEGORY_KEYS[category],
}));

export function buildHistoryRuns(sessions: Session[]): HistoryRun[] {
  return sessions.flatMap((session) =>
    session.items.map((item, index) => ({
      id: item.filePath || `${session.id}:${index}`,
      sessionId: session.id,
      session,
      item,
      scenarioName:
        getScenarioName(item).trim() || i18n.t("history:models.unknownScenario"),
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
        ? compactDateFormatter().format(run.playedAt)
        : `#${i + 1}`,
    fullLabel:
      run.playedAt > 0
        ? sessionFormatter().format(run.playedAt)
        : i18n.t("history:models.attempt", { index: i + 1 }),
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
    ? sessionFormatter().format(startedAt)
    : i18n.t("history:models.untitledSession");
}

export function formatSessionDateRange(session: Session): string {
  const start = readSessionStartTimestamp(session);
  const end = readSessionEndTimestamp(session);

  if (start <= 0 && end <= 0) return i18n.t("history:models.noTimingData");
  if (start <= 0 || end <= 0)
    return sessionFormatter().format(Math.max(start, end));

  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay) {
    return i18n.t("history:models.timeRange", {
      start: sessionFormatter().format(start),
      end: timeFormatter().format(end),
    });
  }

  return i18n.t("history:models.timeRange", {
    start: sessionFormatter().format(start),
    end: sessionFormatter().format(end),
  });
}

export function formatCompactDate(timestamp: number): string {
  return timestamp > 0 ? compactDateFormatter().format(timestamp) : "--";
}

export function formatRunTimestamp(timestamp: number): string {
  return timestamp > 0
    ? sessionFormatter().format(timestamp)
    : i18n.t("history:models.noTimestamp");
}

export function formatRelativeTime(timestamp: number): string {
  if (timestamp <= 0) return "--";

  const diff = timestamp - Date.now();
  const abs = Math.abs(diff);

  if (abs < 60_000) return i18n.t("history:models.justNow");
  if (abs < 3_600_000) {
    const minutes = Math.round(abs / 60_000);
    return i18n.t("history:models.minutesAgo", { count: minutes });
  }
  if (abs < 86_400_000) {
    const hours = Math.round(abs / 3_600_000);
    return i18n.t("history:models.hoursAgo", { count: hours });
  }
  if (abs < 604_800_000) {
    const days = Math.round(abs / 86_400_000);
    return i18n.t("history:models.daysAgo", { count: days });
  }

  const weeks = Math.round(abs / 604_800_000);
  return i18n.t("history:models.weeksAgo", { count: weeks });
}

export function formatDurationLabel(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "--";

  return getActiveLocaleFormatters().formatDuration(durationMs / 1000);
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return getActiveLocaleFormatters().numberFormatter({ maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "--";

  if (decimals <= 0) {
    return getActiveLocaleFormatters().numberFormatter({ maximumFractionDigits: 0 }).format(value);
  }

  return getActiveLocaleFormatters().numberFormatter({
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${getActiveLocaleFormatters().numberFormatter({ maximumFractionDigits: 2 }).format(value)}%`;
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
      value = raw ? "true" : "false";
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) value = trimmed;
    }

    if (value !== "--") {
      entries.push({
        key: field.key,
        label: i18n.t(field.labelKey),
        value,
        category: i18n.t(field.categoryKey),
      });
    }
  }

  return entries;
}

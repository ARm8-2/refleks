import {
  getScenarioName,
  readRunAccuracy,
  readRunDurationMs,
  readRunScore,
  readRunTimestamp,
} from "@/shared/lib";
import type { RunRecord, Session, StatKey } from "@/shared/types";

const sessionFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const preciseNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

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
  label: string;
  category: string;
};

const RUN_STAT_FIELDS: RunStatFieldDefinition[] = [
  { key: "score", label: "Score", category: "Overview" },
  { key: "kills", label: "Kills", category: "Overview" },
  { key: "hitCount", label: "Hit Count", category: "Overview" },
  { key: "accuracy", label: "Accuracy", category: "Overview" },
  { key: "missCount", label: "Miss Count", category: "Accuracy Details" },
  {
    key: "totalOvershots",
    label: "Total Overshots",
    category: "Accuracy Details",
  },
  { key: "damageDone", label: "Damage Done", category: "Accuracy Details" },
  { key: "damageTaken", label: "Damage Taken", category: "Accuracy Details" },
  { key: "fightTime", label: "Fight Time", category: "Timing" },
  { key: "timeRemaining", label: "Time Remaining", category: "Timing" },
  { key: "avgTtk", label: "Avg TTK", category: "Timing" },
  { key: "realAvgTtk", label: "Real Avg TTK", category: "Timing" },
  { key: "pauseCount", label: "Pause Count", category: "Timing" },
  { key: "pauseDuration", label: "Pause Duration", category: "Timing" },
  { key: "challengeStart", label: "Challenge Start", category: "Timing" },
  { key: "duration", label: "Duration", category: "Timing" },
  { key: "sensScale", label: "Sens Scale", category: "Controls" },
  { key: "sensIncrement", label: "Sens Increment", category: "Controls" },
  { key: "horizSens", label: "Horiz Sens", category: "Controls" },
  { key: "vertSens", label: "Vert Sens", category: "Controls" },
  { key: "dpi", label: "DPI", category: "Controls" },
  { key: "cm360", label: "cm/360", category: "Controls" },
  { key: "fov", label: "FOV", category: "Display" },
  { key: "fovScale", label: "FOVScale", category: "Display" },
  { key: "resolution", label: "Resolution", category: "Display" },
  { key: "hideGun", label: "Hide Gun", category: "Display" },
  { key: "crosshair", label: "Crosshair", category: "Display" },
  { key: "crosshairScale", label: "Crosshair Scale", category: "Display" },
  { key: "crosshairColor", label: "Crosshair Color", category: "Display" },
  { key: "inputLag", label: "Input Lag", category: "Technical" },
  { key: "maxFpsConfig", label: "Max FPS (config)", category: "Technical" },
  { key: "avgFps", label: "Avg FPS", category: "Technical" },
  { key: "resolutionScale", label: "Resolution Scale", category: "Technical" },
  { key: "scenario", label: "Scenario", category: "Game Information" },
  { key: "hash", label: "Hash", category: "Game Information" },
  { key: "gameVersion", label: "Game Version", category: "Game Information" },
  { key: "datePlayed", label: "Date Played", category: "Game Information" },
  {
    key: "distanceTraveled",
    label: "Distance Traveled",
    category: "Game Information",
  },
  { key: "mbsPoints", label: "MBS Points", category: "Game Information" },
  { key: "midairs", label: "Midairs", category: "Additional Stats" },
  { key: "midaired", label: "Midaired", category: "Additional Stats" },
  { key: "directs", label: "Directs", category: "Additional Stats" },
  { key: "directed", label: "Directed", category: "Additional Stats" },
  { key: "deaths", label: "Deaths", category: "Additional Stats" },
  {
    key: "avgTargetScale",
    label: "Avg Target Scale",
    category: "Additional Stats",
  },
  {
    key: "avgTimeDilation",
    label: "Avg Time Dilation",
    category: "Additional Stats",
  },
  { key: "reloads", label: "Reloads", category: "Additional Stats" },
];

export function buildHistoryRuns(sessions: Session[]): HistoryRun[] {
  return sessions.flatMap((session) =>
    session.items.map((item, index) => ({
      id: item.filePath || `${session.id}:${index}`,
      sessionId: session.id,
      session,
      item,
      scenarioName: getScenarioName(item).trim() || "Unknown scenario",
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
        ? compactDateFormatter.format(run.playedAt)
        : `#${i + 1}`,
    fullLabel:
      run.playedAt > 0
        ? sessionFormatter.format(run.playedAt)
        : `Attempt #${i + 1}`,
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
    ? sessionFormatter.format(startedAt)
    : "Untitled session";
}

export function formatSessionDateRange(session: Session): string {
  const start = readSessionStartTimestamp(session);
  const end = readSessionEndTimestamp(session);

  if (start <= 0 && end <= 0) return "No timing data";
  if (start <= 0 || end <= 0)
    return sessionFormatter.format(Math.max(start, end));

  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay) {
    return `${sessionFormatter.format(start)} to ${timeFormatter.format(end)}`;
  }

  return `${sessionFormatter.format(start)} to ${sessionFormatter.format(end)}`;
}

export function formatCompactDate(timestamp: number): string {
  return timestamp > 0 ? compactDateFormatter.format(timestamp) : "--";
}

export function formatRunTimestamp(timestamp: number): string {
  return timestamp > 0 ? sessionFormatter.format(timestamp) : "No timestamp";
}

export function formatRelativeTime(timestamp: number): string {
  if (timestamp <= 0) return "--";

  const diff = timestamp - Date.now();
  const abs = Math.abs(diff);

  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) {
    const minutes = Math.round(abs / 60_000);
    return `${minutes}m ago`;
  }
  if (abs < 86_400_000) {
    const hours = Math.round(abs / 3_600_000);
    return `${hours}h ago`;
  }
  if (abs < 604_800_000) {
    const days = Math.round(abs / 86_400_000);
    return `${days}d ago`;
  }

  const weeks = Math.round(abs / 604_800_000);
  return `${weeks}w ago`;
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
  return numberFormatter.format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "--";

  if (decimals <= 0) {
    return numberFormatter.format(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${preciseNumberFormatter.format(value)}%`;
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
        label: field.label,
        value,
        category: field.category,
      });
    }
  }

  return entries;
}

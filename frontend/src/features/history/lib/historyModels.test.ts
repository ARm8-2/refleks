import { afterEach, describe, expect, it } from "vitest";
import { applyLocale, translate } from "@/shared/lib/i18n";
import type { RunRecord, Session } from "@/shared/types";
import {
  buildHistoryRuns,
  buildRunStats,
  buildSessionScenarioSummaries,
  buildSessionScenarioTrendPoints,
  formatDurationLabel,
  formatNumber,
  formatPercent,
  formatScore,
  formatSessionDateRange,
  formatSessionTitle,
  matchRunSearch,
  matchSessionSearch,
  readSessionActivePlaytimeMs,
  readSessionAverageScore,
  readSessionDurationMs,
  readSessionEndTimestamp,
  readSessionStartTimestamp,
  readTopRepeatedScenario,
  readUniqueScenarioCount,
} from "./historyModels";

function makeRun(
  scenario: string,
  options: {
    filePath?: string;
    fileName?: string;
    datePlayed?: string;
    score?: unknown;
    accuracy?: unknown;
    duration?: unknown;
    hideGun?: boolean;
  } = {},
): RunRecord {
  return {
    filePath: options.filePath ?? "",
    fileName: options.fileName ?? `${scenario} - run.csv`,
    stats: {
      summary: {
        scenario,
        datePlayed: options.datePlayed,
        score: options.score ?? 0,
        accuracy: options.accuracy,
        duration: options.duration,
        hideGun: options.hideGun,
      },
    },
  } as unknown as RunRecord;
}

function makeSession(
  id: string,
  items: RunRecord[],
  options: { start?: string; end?: string; name?: string } = {},
): Session {
  return {
    id,
    start: options.start ?? "",
    end: options.end ?? "",
    items,
    name: options.name,
  };
}

afterEach(() => {
  applyLocale("en");
});

describe("history run and session models", () => {
  it("maps session runs while preserving order and using stable fallback IDs", () => {
    const session = makeSession("session-a", [
      makeRun("Tile Frenzy", {
        filePath: "/runs/one.run",
        datePlayed: "2025-01-02T12:00:00.000Z",
        score: "1,200",
        accuracy: 0.85,
        duration: "01:02",
      }),
      makeRun("Smoothbot", { score: 450 }),
    ]);

    const runs = buildHistoryRuns([session]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      id: "/runs/one.run",
      sessionId: "session-a",
      scenarioName: "Tile Frenzy",
      playedAt: Date.parse("2025-01-02T12:00:00.000Z"),
      score: 1200,
      accuracy: 85,
      durationMs: 62_000,
      orderInSession: 0,
    });
    expect(runs[1]).toMatchObject({
      id: "session-a:1",
      scenarioName: "Smoothbot",
      score: 450,
      orderInSession: 1,
    });
    expect(runs[0].session).toBe(session);
  });

  it("derives session times from runs when stored session times are invalid", () => {
    const session = makeSession("session-b", [
      makeRun("A", {
        datePlayed: "2025-01-03T12:00:00.000Z",
        score: 100,
        duration: 10,
      }),
      makeRun("A", {
        datePlayed: "2025-01-01T12:00:00.000Z",
        score: 0,
        duration: 20,
      }),
      makeRun("B", {
        datePlayed: "2025-01-02T12:00:00.000Z",
        score: 200,
        duration: 30,
      }),
    ]);

    expect(readSessionStartTimestamp(session)).toBe(
      Date.parse("2025-01-01T12:00:00.000Z"),
    );
    expect(readSessionEndTimestamp(session)).toBe(
      Date.parse("2025-01-03T12:00:00.000Z"),
    );
    expect(readSessionDurationMs(session)).toBe(2 * 24 * 60 * 60 * 1000);
    expect(readSessionActivePlaytimeMs(session)).toBe(60_000);
    expect(readUniqueScenarioCount(session)).toBe(2);
    expect(readSessionAverageScore(session)).toBe(150);
    expect(readTopRepeatedScenario(session)).toEqual({ name: "A", attempts: 2 });
  });

  it("prefers valid stored session boundaries and handles empty-session metrics", () => {
    const start = "2025-03-01T10:00:00.000Z";
    const end = "2025-03-01T10:30:00.000Z";
    const session = makeSession("session-c", [], { start, end });
    const empty = makeSession("empty", []);

    expect(readSessionStartTimestamp(session)).toBe(Date.parse(start));
    expect(readSessionEndTimestamp(session)).toBe(Date.parse(end));
    expect(readSessionDurationMs(session)).toBe(30 * 60 * 1000);
    expect(readSessionDurationMs(empty)).toBe(0);
    expect(readUniqueScenarioCount(empty)).toBe(0);
    expect(readSessionActivePlaytimeMs(empty)).toBe(0);
    expect(readSessionAverageScore(empty)).toBe(0);
    expect(readTopRepeatedScenario(empty)).toBeNull();
  });

  it("summarizes per-scenario counts, best scores, and trends against the prior session", () => {
    const current = makeSession("current", [
      makeRun("Alpha", { score: 100 }),
      makeRun("Alpha", { score: 150 }),
      makeRun("Beta", { score: 40 }),
      makeRun("Delta", { score: 20 }),
      makeRun("Gamma", { score: 25 }),
    ]);
    const previous = makeSession("previous", [
      makeRun("Alpha", { score: 120 }),
      makeRun("Beta", { score: 60 }),
      makeRun("Delta", { score: 20 }),
    ]);

    expect(buildSessionScenarioSummaries(current, [current, previous])).toEqual([
      { name: "Alpha", count: 2, bestScore: 150, trend: "up" },
      { name: "Beta", count: 1, bestScore: 40, trend: "down" },
      { name: "Delta", count: 1, bestScore: 20, trend: "same" },
      { name: "Gamma", count: 1, bestScore: 25, trend: null },
    ]);
    expect(buildSessionScenarioSummaries(current, [current])[1]?.trend).toBe(
      null,
    );
  });

  it("creates oldest-to-newest trend points for only the requested scenario", () => {
    const session = makeSession("trend-session", [
      makeRun("Alpha", { score: 200 }),
      makeRun("Beta", { score: 300 }),
      makeRun("Alpha", { score: 100 }),
    ]);
    const runs = buildHistoryRuns([session]);

    expect(buildSessionScenarioTrendPoints("Alpha", runs)).toEqual([
      {
        label: "#1",
        fullLabel: translate("history.overview.attempt", { count: 1 }),
        score: 100,
        accuracy: null,
        runId: "trend-session:2",
      },
      {
        label: "#2",
        fullLabel: translate("history.overview.attempt", { count: 2 }),
        score: 200,
        accuracy: null,
        runId: "trend-session:0",
      },
    ]);
  });
});

describe("history formatting and search", () => {
  it("formats session titles, missing timing, and duration values", () => {
    expect(formatSessionTitle(makeSession("named", [], { name: "  Aim block  " }))).toBe(
      "Aim block",
    );
    expect(formatSessionTitle(makeSession("untitled", []))).toBe(
      translate("history.session.untitled"),
    );
    expect(formatSessionDateRange(makeSession("untimed", []))).toBe(
      translate("history.session.noTimingData"),
    );
    expect(formatDurationLabel(3_723_000)).toBe("1h 2m");
    expect(formatDurationLabel(62_000)).toBe("1m 2s");
    expect(formatDurationLabel(1_400)).toBe("1s");
    expect(formatDurationLabel(Number.NaN)).toBe("--");
  });

  it("formats localized numbers and percentages with invalid-value fallbacks", () => {
    expect(formatNumber(1234.567)).toBe("1,235");
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
    expect(formatNumber(Number.NaN)).toBe("--");
    expect(formatScore(1234)).toBe("1,234");
    expect(formatScore(0)).toBe("--");
    expect(formatPercent(85.456)).toBe("85.46%");
    expect(formatPercent(null)).toBe("--");
  });

  it("matches sessions and runs case-insensitively and accepts blank queries", () => {
    const session = makeSession("search", [makeRun("Tile Frenzy")]);
    const run = buildHistoryRuns([session])[0];

    expect(matchSessionSearch(session, "  ")).toBe(true);
    expect(matchSessionSearch(session, "TILE FRENZY")).toBe(true);
    expect(matchSessionSearch(session, "missing")).toBe(false);
    expect(matchRunSearch(run, "")).toBe(true);
    expect(matchRunSearch(run, "TILE")).toBe(true);
    expect(matchRunSearch(run, "run.csv")).toBe(true);
    expect(matchRunSearch(run, "missing")).toBe(false);
  });

  it("builds translated run stat rows and omits blank values", () => {
    const run = makeRun("Tile Frenzy", {
      score: 1234,
      accuracy: 0.85,
      duration: 62,
      hideGun: true,
    });
    const rows = buildRunStats(run);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "score", value: "1,234" }),
        expect.objectContaining({ key: "accuracy", value: "85%" }),
        expect.objectContaining({ key: "duration", value: "1m 2s" }),
        expect.objectContaining({
          key: "hideGun",
          value: translate("common.yes"),
        }),
      ]),
    );
    expect(rows.some((row) => row.key === "scenario" && row.value === "")).toBe(
      false,
    );
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/shared/hooks";
import { applyLocale } from "@/shared/lib/i18n";
import type { RunRecord } from "@/shared/types";
import {
  useRecentSessionSnapshot,
  type RecentSessionSnapshot,
} from "./useRecentSessionSnapshot";

afterEach(() => {
  cleanup();
  applyLocale("en");
});

beforeEach(() => applyLocale("en"));

function makeRun(
  id: string,
  timestamp: number,
  score: number,
  accuracy: number,
): RunRecord {
  return {
    filePath: `/runs/${id}.run`,
    fileName: `Scenario Alpha - ${id}.csv`,
    stats: {
      summary: {
        scenario: "Scenario Alpha",
        datePlayed: new Date(timestamp).toISOString(),
        score,
        accuracy,
        duration: 120,
      },
    },
  } as unknown as RunRecord;
}

function makeSessionRuns(
  dayOffsets: number[],
  scoresBySession: number[][],
): RunRecord[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const intervalMs = 5 * 60 * 1000;

  return dayOffsets.flatMap((daysAgo, sessionIndex) =>
    scoresBySession[sessionIndex].map((score, runIndex) =>
      makeRun(
        `session-${sessionIndex}-run-${runIndex}`,
        now - daysAgo * dayMs - (scoresBySession[sessionIndex].length - runIndex - 1) * intervalMs,
        score,
        0.6 + runIndex * 0.05,
      ),
    ),
  );
}

function seededWrapper(runs: RunRecord[]) {
  function SeedRuns({ children }: { children: ReactNode }) {
    const setRuns = useStore((state) => state.setRuns);
    useEffect(() => setRuns(runs), [runs, setRuns]);
    return <>{children}</>;
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StoreProvider>
        <SeedRuns>{children}</SeedRuns>
      </StoreProvider>
    );
  };
}

function renderSnapshot(runs: RunRecord[] = []) {
  return renderHook(() => useRecentSessionSnapshot(), {
    wrapper: seededWrapper(runs),
  });
}

describe("useRecentSessionSnapshot", () => {
  it("returns safe defaults when no runs are loaded", () => {
    const { result } = renderSnapshot();

    expect(result.current.currentSession).toBeNull();
    expect(result.current.currentRuns).toBe(0);
    expect(result.current.lastRunScore).toBeNull();
    expect(result.current.recentScores).toEqual([]);
    expect(result.current.suggestedRuns).toBe(8);
    expect(result.current.statusLabel).toBe("No session");
  });

  it("derives run trends and session playtime from the current session", async () => {
    const now = Date.now();
    const runs = [
      makeRun("run-1", now - 10 * 60_000, 1000, 0.7),
      makeRun("run-2", now - 5 * 60_000, 1200, 0.75),
      makeRun("run-3", now, 1400, 0.8),
    ];
    const { result } = renderSnapshot(runs);

    await waitFor(() => expect(result.current.currentRuns).toBe(3));

    expect(result.current.currentSession).not.toBeNull();
    expect(result.current.isInSession).toBe(true);
    expect(result.current.lastRunScenario).toBe("Scenario Alpha");
    expect(result.current.lastRunScore).toBe(1400);
    expect(result.current.lastRunAccuracy).toBe(0.8);
    expect(result.current.lastRunScoreTrend).toBe("up");
    expect(result.current.lastRunAccTrend).toBe("up");
    expect(result.current.sessionLengthLabel).toBe("10m");
    expect(result.current.activePlaytimeLabel).toBe("6m");
    expect(result.current.performanceDetail).toContain("Warming up");
    expect(result.current.suggestedRuns).toBe(8);
  });

  it("builds cross-session score history and session-length recommendations", async () => {
    const runs = makeSessionRuns(
      [3, 2, 1, 0],
      [
        [500, 600, 700, 800, 900],
        [700, 800, 900, 1000, 1100],
        [900, 1000, 1100, 1200, 1300],
        [1100, 1200, 1300, 1400, 1500],
      ],
    );
    const { result } = renderSnapshot(runs);

    await waitFor(() => expect(result.current.sessionsAnalyzed).toBe(4));

    expect(result.current.currentRuns).toBe(5);
    expect(result.current.statusTone).toBe("success");
    expect(result.current.statusLabel).toBe("Above usual");
    expect(result.current.suggestedRuns).toBeGreaterThan(0);
    expect(result.current.warmupRuns).toBeGreaterThan(0);
    expect(result.current.recentScores).toHaveLength(20);
    expect(result.current.recentScores[0]).toMatchObject({
      index: 1,
      score: 500,
      inCurrentSession: false,
    });
    expect(result.current.recentScores.at(-1)).toMatchObject({
      index: 20,
      score: 1500,
      inCurrentSession: true,
    });
    expect(result.current.recentScoresSessionStartIndex).toBe(16);
    expect(result.current.recentScoresSessionBest).toBe(1500);
    expect(result.current.recentScoresPb).toBe(1500);
    expect(result.current.topStreak).toBe(4);
  });
});

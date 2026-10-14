import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunRecord, Session } from "@/shared/types";
import {
  computeRecommendationScores,
  selectTopPicks,
  type RecommendationInputs,
  type ScenarioBenchmarkData,
} from "./detailRecommendations";

const FIXED_NOW = new Date("2026-05-01T12:00:00.000Z");

function makeBenchmarkData(
  overrides: Partial<ScenarioBenchmarkData> = {},
): ScenarioBenchmarkData {
  return { rank: 0, score: 50, thresholds: [0, 100], ...overrides };
}

function makeRun(scenario: string, score: number): RunRecord {
  return {
    stats: { summary: { scenario, score } },
  } as unknown as RunRecord;
}

function makeSession(start: Date, scenario: string, score: number): Session {
  return {
    id: start.toISOString(),
    start: start.toISOString(),
    end: start.toISOString(),
    items: [makeRun(scenario, score)],
  };
}

function makeInput(sessions: Session[]): RecommendationInputs {
  return {
    wantedNames: ["Scenario"],
    lastSessionCount: new Map(),
    sessions,
    benchmarkData: new Map([["Scenario", makeBenchmarkData()]]),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeRecommendationScores", () => {
  it("returns an entry for each requested scenario, including missing benchmark data", () => {
    const scores = computeRecommendationScores({
      wantedNames: ["Missing"],
      lastSessionCount: new Map(),
      sessions: [],
      benchmarkData: new Map(),
    });

    expect(scores).toEqual(new Map([["Missing", 0]]));
  });

  it("favors improving practice history over a flat plateau", () => {
    const newest = new Date(FIXED_NOW.getTime() - 60 * 60 * 1000);
    const sessionsFor = (scores: number[]) =>
      scores.map((score, index) =>
        makeSession(
          new Date(newest.getTime() - index * 60 * 60 * 1000),
          "Scenario",
          score,
        ),
      );

    const improving = computeRecommendationScores(
      makeInput(sessionsFor([80, 60, 40])),
    ).get("Scenario");
    const plateau = computeRecommendationScores(
      makeInput(sessionsFor([50, 50, 50])),
    ).get("Scenario");

    expect(improving).toBeDefined();
    expect(plateau).toBeDefined();
    expect(improving).toBeGreaterThan(plateau!);
  });
});

describe("selectTopPicks", () => {
  it("prioritizes high scores while preferring distinct categories", () => {
    const picks = selectTopPicks(
      new Map([
        ["A", 10],
        ["B", 9],
        ["C", 9],
        ["Below candidate cutoff", 8],
      ]),
      new Map([
        ["A", "tracking"],
        ["B", "tracking"],
        ["C", "clicking"],
      ]),
      2,
    );

    expect(picks).toEqual(new Set(["A", "C"]));
  });

  it("fills remaining picks without categories and respects the maximum", () => {
    const picks = selectTopPicks(
      new Map([
        ["A", 5],
        ["B", 4],
        ["C", 3],
        ["Not recommended", 1],
      ]),
      new Map(),
      2,
    );

    expect(picks).toEqual(new Set(["A", "B"]));
    expect(selectTopPicks(new Map([["A", 5]]), new Map(), 0)).toEqual(
      new Set(),
    );
  });
});

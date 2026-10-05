import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Benchmark, BenchmarkProgress, Session } from "@/shared/types";
import { getRecommendedBenchmarks } from "./recommendations";

function makeBenchmark(name: string, ids: number[] = [1]): Benchmark {
  return {
    benchmarkName: name,
    rankCalculation: "complete",
    abbreviation: name,
    color: "#ffffff",
    spreadsheetURL: "",
    difficulties: ids.map((kovaaksBenchmarkId, index) => ({
      difficultyName: `Difficulty ${index + 1}`,
      kovaaksBenchmarkId,
      sharecode: "",
    })),
  };
}

function makeProgress(
  overallRank: number,
  ranks: number,
  scenarioRank = 0,
  score = 0,
): BenchmarkProgress {
  return {
    overallRank,
    benchmarkProgress: 0,
    ranks: Array.from({ length: ranks }, (_, index) => ({
      name: `Rank ${index + 1}`,
      color: "#ffffff",
    })),
    categories: [
      {
        name: "Category",
        groups: [
          {
            scenarios: [
              { name: "Scenario", scenarioRank, score, thresholds: [0, 100] },
            ],
          },
        ],
      },
    ],
  };
}

function makeSessions(count: number): Session[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `session-${index}`,
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-01T00:01:00.000Z",
    items: [],
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getRecommendedBenchmarks", () => {
  it("returns no recommendations when there are no eligible benchmarks", () => {
    expect(getRecommendedBenchmarks([], {})).toEqual([]);
    expect(getRecommendedBenchmarks([makeBenchmark("No difficulties", [])], {}))
      .toEqual([]);
  });

  it("prioritizes an in-progress benchmark over a new one", () => {
    const inProgress = makeBenchmark("In progress", [1]);
    const fresh = makeBenchmark("Fresh", [2]);
    const recommendations = getRecommendedBenchmarks(
      [fresh, inProgress],
      { 1: makeProgress(0, 2, 0, 50) },
    );

    expect(recommendations[0]).toBe(inProgress);
    expect(recommendations).toContain(fresh);
  });

  it("moves to the next difficulty after the previous one is maxed", () => {
    const multiDifficulty = makeBenchmark("Multi difficulty", [10, 11]);
    const fresh = makeBenchmark("Fresh", [20]);
    const recommendations = getRecommendedBenchmarks(
      [fresh, multiDifficulty],
      { 10: makeProgress(2, 2) },
    );

    expect(recommendations[0]).toBe(multiDifficulty);
  });

  it("gives beginner benchmarks a boost when the player has few sessions", () => {
    const starter = makeBenchmark("Voltaic S5", [1]);
    const ordinary = makeBenchmark("Ordinary benchmark", [2]);
    const recommendations = getRecommendedBenchmarks(
      [ordinary, starter],
      {},
      makeSessions(9),
    );

    expect(recommendations[0]).toBe(starter);
  });

  it("limits the result to five and is deterministic for the same day", () => {
    const benchmarks = Array.from({ length: 8 }, (_, index) =>
      makeBenchmark(`Benchmark ${index}`, [index + 1]),
    );
    const first = getRecommendedBenchmarks(benchmarks, {});
    const second = getRecommendedBenchmarks(benchmarks, {});

    expect(first).toHaveLength(5);
    expect(second).toEqual(first);
  });
});

// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BenchmarkProgress } from "@/shared/types";
import { benchmarkDetailVisibilityStorageKey } from "@/shared/lib/storageKeys";
import { useBenchmarkVisibility } from "./useBenchmarkVisibility";

afterEach(() => cleanup());

beforeEach(() => window.localStorage.clear());

const storagePrefix = "refleks.benchmarks.detail.visibility-test";
const progress: BenchmarkProgress = {
  overallRank: 2,
  benchmarkProgress: 0.5,
  ranks: ["Iron", "Bronze", "Silver", "Gold"].map((name) => ({
    name,
    color: "#000000",
  })),
  categories: [
    {
      name: "Clicking",
      groups: [
        {
          scenarios: [
            { name: "Scenario A", score: 100, scenarioRank: 4, thresholds: [] },
            { name: "Scenario B", score: 80, scenarioRank: 4, thresholds: [] },
          ],
        },
      ],
    },
  ],
};

describe("useBenchmarkVisibility", () => {
  it("persists manual rank visibility changes", () => {
    const { result } = renderHook(() =>
      useBenchmarkVisibility({ storagePrefix, progress }),
    );

    expect(result.current.visibleRankIndices).toEqual([0, 1, 2, 3]);

    act(() => result.current.toggleManualRank(1));

    expect(result.current.visibleRankIndices).toEqual([0, 2, 3]);
    expect(result.current.visibleRanks.map((rank) => rank.name)).toEqual([
      "Iron",
      "Silver",
      "Gold",
    ]);
    expect(
      window.localStorage.getItem(
        benchmarkDetailVisibilityStorageKey(storagePrefix, "manualHidden"),
      ),
    ).toBe("[1]");

    act(() => result.current.toggleManualRank(1));
    expect(result.current.visibleRankIndices).toEqual([0, 1, 2, 3]);
  });

  it("hides cleared ranks automatically while keeping the requested count visible", () => {
    const { result } = renderHook(() =>
      useBenchmarkVisibility({ storagePrefix, progress }),
    );

    act(() => {
      result.current.setAutoHideCleared(true);
      result.current.setVisibleRankCount(2);
    });

    expect(result.current.autoHidden).toEqual(new Set([0, 1]));
    expect(result.current.visibleRankIndices).toEqual([2, 3]);
    expect(result.current.visibleRanks.map((rank) => rank.name)).toEqual([
      "Silver",
      "Gold",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { RunStatsEvent, RunStatsSummary } from "@/shared/types";
import { computeScenarioAnalysis } from "./scenarioAnalysis";

function makeStats(challengeStart = "09:00:00"): RunStatsSummary {
  return { challengeStart } as unknown as RunStatsSummary;
}

function makeEvent(
  timestamp: string,
  shots: number,
  hits: number,
): RunStatsEvent {
  return {
    timestamp,
    shots,
    hits,
  } as RunStatsEvent;
}

describe("computeScenarioAnalysis", () => {
  it("returns null when there are no parseable kill events", () => {
    expect(computeScenarioAnalysis(makeStats(), [])).toBeNull();
    expect(
      computeScenarioAnalysis(makeStats(), [makeEvent("invalid", 1, 1)]),
    ).toBeNull();
  });

  it("calculates relative kill timing, accuracy, and summary statistics", () => {
    const analysis = computeScenarioAnalysis(makeStats(), [
      makeEvent("09:00:00", 2, 1),
      makeEvent("09:00:02", 2, 2),
      makeEvent("09:00:05", 1, 0),
    ]);

    expect(analysis).not.toBeNull();
    expect(analysis).toMatchObject({
      labels: ["0:00", "0:02", "0:05"],
      timeSec: [0, 2, 5],
      realTTK: [0, 2, 3],
      accOverTime: [0.5, 0.75, 0.6],
      cumKills: [1, 2, 3],
      perKillAcc: [0.5, 1, 0],
      kpm: [0, 30, 20],
      summary: {
        kills: 3,
        shots: 5,
        hits: 3,
        finalAcc: 0.6,
        longestGap: 3,
        avgGap: 2.5,
        medianTTK: 2,
      },
    });
  });

  it("handles a midnight rollover and ignores events with invalid timestamps", () => {
    const analysis = computeScenarioAnalysis(makeStats("23:59:00"), [
      makeEvent("23:59:58", 1, 1),
      makeEvent("bad timestamp", 20, 20),
      makeEvent("00:00:01", 2, 1),
    ]);

    expect(analysis?.timeSec).toEqual([0, 3]);
    expect(analysis?.realTTK).toEqual([0, 3]);
    expect(analysis?.summary).toMatchObject({
      kills: 2,
      shots: 3,
      hits: 2,
      longestGap: 3,
    });
  });

  it("clamps per-kill accuracy while keeping cumulative hit totals", () => {
    const analysis = computeScenarioAnalysis(makeStats(), [
      makeEvent("09:00:00", 1, 3),
    ]);

    expect(analysis?.perKillAcc).toEqual([1]);
    expect(analysis?.accOverTime).toEqual([3]);
    expect(analysis?.summary.finalAcc).toBe(3);
  });
});

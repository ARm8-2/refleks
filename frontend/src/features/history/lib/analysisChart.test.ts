import { describe, expect, it } from "vitest";
import type {
  RunPerformanceEvent,
  RunStatsEvent,
  RunStatsSummary,
} from "@/shared/types";
import type { ScenarioAnalysis } from "./scenarioAnalysis";
import { buildAnalysisChartData } from "./analysisChart";

function makeSummary(challengeStart = "10:00:00"): RunStatsSummary {
  return { challengeStart } as unknown as RunStatsSummary;
}

function makeStatsEvent(
  timestamp: string,
  shots: number,
  hits: number,
): RunStatsEvent {
  return { timestamp, shots, hits } as RunStatsEvent;
}

function makePerformanceEvent(
  timestamp: number,
  payloadType: string,
  count: number,
): RunPerformanceEvent {
  return { timestamp, payloadType, count };
}

describe("buildAnalysisChartData", () => {
  it("builds a cumulative kill timeline and extends it to a nearby time limit", () => {
    const chart = buildAnalysisChartData(
      null,
      makeSummary(),
      [
        makeStatsEvent("10:00:02", 2, 1),
        makeStatsEvent("10:00:05", 2, 2),
      ],
      [],
      6,
    );

    expect(chart.events).toEqual([
      { timeSec: 2, killsOverTime: 1, accOverTime: 50 },
      { timeSec: 5, killsOverTime: 2, accOverTime: 75 },
      { timeSec: 6, killsOverTime: 2, accOverTime: 75 },
    ]);
    expect(chart.eventsDomainMax).toBe(6);
    expect(chart.ttk).toEqual([]);
    expect(chart.scatter).toEqual([]);
  });

  it("merges performance accuracy samples with kill markers and forward-fills kills", () => {
    const chart = buildAnalysisChartData(
      null,
      makeSummary("00:00:00"),
      [makeStatsEvent("00:00:02", 2, 1)],
      [
        makePerformanceEvent(1, "shotsFired", 2),
        makePerformanceEvent(1, "shotsHit", 1),
      ],
      2.5,
    );

    expect(chart.events).toEqual([
      { timeSec: 0, killsOverTime: 0, accOverTime: 50 },
      { timeSec: 1, killsOverTime: 0, accOverTime: 50 },
      { timeSec: 2, killsOverTime: 1, accOverTime: 50 },
      { timeSec: 2.5, killsOverTime: 1, accOverTime: 50 },
    ]);
    expect(chart.eventsDomainMax).toBe(2.5);
  });

  it("uses the final sample instead of an implausibly distant time limit", () => {
    const chart = buildAnalysisChartData(
      null,
      makeSummary(),
      [makeStatsEvent("10:00:02", 1, 1)],
      [],
      10,
    );

    expect(chart.eventsDomainMax).toBe(2);
    expect(chart.events).toHaveLength(1);
    expect(chart.events[0].timeSec).toBe(2);
  });

  it("keeps analysis chart series rounded to display precision", () => {
    const analysis = {
      timeSec: [1.23456],
      realTTK: [2.34567],
      movingAvg: { ma5: [3.45678] },
      kpm: [4.56],
      perKillAcc: [0.7894],
    } as unknown as ScenarioAnalysis;

    const chart = buildAnalysisChartData(
      analysis,
      makeSummary("invalid"),
      [],
      [],
    );

    expect(chart.ttk).toEqual([
      { timeSec: 1.235, realTTK: 2.346, ma5: 3.457 },
    ]);
    expect(chart.scatter).toEqual([{ x: 4.6, y: 78.9 }]);
    expect(chart.events).toEqual([]);
  });

  it("returns no event timeline when neither a challenge start nor kill time is valid", () => {
    const chart = buildAnalysisChartData(
      null,
      makeSummary("invalid"),
      [],
      [makePerformanceEvent(1, "shotsFired", 2)],
      60,
    );

    expect(chart.events).toEqual([]);
    expect(chart.eventsDomainMax).toBe(0);
  });
});

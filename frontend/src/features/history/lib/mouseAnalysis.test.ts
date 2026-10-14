import { describe, expect, it } from "vitest";
import type {
  MousePoint,
  RunStatsEvent,
  RunStatsSummary,
} from "@/shared/types";
import {
  computeMouseTraceAnalysis,
  computeSuggestedSens,
  type MouseTraceAnalysis,
} from "./mouseAnalysis";

const TRACE_START = Date.UTC(2026, 0, 1, 10, 0, 0);

function makeSummary(): RunStatsSummary {
  return {
    challengeStart: "10:00:00",
    datePlayed: "2026-01-01T10:00:01.000Z",
    cm360: 30,
  } as RunStatsSummary;
}

function makeKillEvent(timestamp = "10:00:01"): RunStatsEvent {
  return {
    killIndex: 1,
    timestamp,
    bot: "",
    weapon: "",
    ttkSeconds: 0.6,
    shots: 5,
    hits: 5,
    accuracy: 100,
    damageDone: 0,
    damagePossible: 0,
    efficiency: 0,
    cheated: false,
    overShots: 0,
  };
}

function makeStraightTrace(): MousePoint[] {
  return Array.from({ length: 13 }, (_, index) => ({
    ts: TRACE_START + 400 + index * 50,
    x: index * 2,
    y: 0,
  }));
}

function makeOvershootTrace(): MousePoint[] {
  const approach = Array.from({ length: 11 }, (_, index) => ({
    ts: TRACE_START + 400 + index * 20,
    x: index * 10,
    y: 0,
  }));
  const overshoot = Array.from({ length: 10 }, (_, index) => ({
    ts: TRACE_START + 620 + index * 20,
    x: 115 + index * 15,
    y: 0,
  }));
  const correction = Array.from({ length: 10 }, (_, index) => ({
    ts: TRACE_START + 820 + index * 20,
    x: 235 - index * 15,
    y: 0,
  }));
  return [...approach, ...overshoot, ...correction];
}

function makeSensitivityAnalysis(
  classification: "overshoot" | "undershoot",
): MouseTraceAnalysis {
  const kills = Array.from({ length: 5 }, () => ({
    classification,
    confidence: 0.7,
    overshootPixels: classification === "overshoot" ? 20 : 0,
    undershootPixels: classification === "undershoot" ? 20 : 0,
    estRadius: 10,
    clickedWhileMoving: false,
  }));
  return {
    kills,
    severityCounts: {
      overshoot: {
        slight: 0,
        moderate: 0,
        severe: classification === "overshoot" ? 5 : 0,
      },
      undershoot: {
        slight: 0,
        moderate: classification === "undershoot" ? 5 : 0,
        severe: 0,
      },
    },
  } as unknown as MouseTraceAnalysis;
}

describe("computeMouseTraceAnalysis", () => {
  it("returns no analysis without enough trace points or kill events", () => {
    expect(
      computeMouseTraceAnalysis(makeSummary(), [], makeStraightTrace()),
    ).toBe(null);
    expect(
      computeMouseTraceAnalysis(
        makeSummary(),
        [makeKillEvent()],
        [{ ts: TRACE_START, x: 0, y: 0 }],
      ),
    ).toBeNull();
  });

  it("analyzes a well-sampled straight movement as an optimal kill", () => {
    const result = computeMouseTraceAnalysis(
      makeSummary(),
      [makeKillEvent()],
      makeStraightTrace(),
    );

    expect(result).not.toBeNull();
    expect(result?.analyzedKillCount).toBe(1);
    expect(result?.knownKillCount).toBe(1);
    expect(result?.counts.optimal).toBe(1);
    expect(result?.kills[0]).toMatchObject({
      classification: "optimal",
      stats: { shots: 5, hits: 5, ttkSec: 0.6 },
      coordinateSpace: "raw-input",
      targetEvidence: "inferred-endpoint",
    });
    expect(result?.kills[0].traceQuality).toMatchObject({
      sampleCount: 13,
      maxGapMs: 50,
      hasLargeGap: false,
    });
  });

  it("classifies a clear overshoot followed by a return", () => {
    const result = computeMouseTraceAnalysis(
      makeSummary(),
      [makeKillEvent()],
      makeOvershootTrace(),
    );

    expect(result?.counts.overshoot).toBe(1);
    expect(result?.kills[0]).toMatchObject({
      classification: "overshoot",
      targetEvidence: "inferred-endpoint",
    });
    expect(result?.kills[0].overshootPixels).toBeGreaterThan(0);
  });

  it("ignores kill events that fall outside the captured trace", () => {
    const result = computeMouseTraceAnalysis(
      makeSummary(),
      [makeKillEvent("10:00:10")],
      makeStraightTrace(),
    );

    expect(result).toBeNull();
  });
});

describe("computeSuggestedSens", () => {
  it("suggests slower sensitivity for repeated undershooting", () => {
    const suggestion = computeSuggestedSens(
      makeSensitivityAnalysis("undershoot"),
      makeSummary(),
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion).toMatchObject({
      direction: "slower",
      primaryIssue: "undershoot",
      severity: "moderate",
    });
    expect(suggestion!.recommended).toBeGreaterThan(30);
  });

  it("does not suggest a change without enough high-confidence kills", () => {
    const analysis = makeSensitivityAnalysis("overshoot");
    analysis.kills = analysis.kills.slice(0, 4);

    expect(computeSuggestedSens(analysis, makeSummary())).toBeNull();
  });
});

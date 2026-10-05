import { describe, expect, it } from "vitest";
import type { RunRecord } from "../types";
import {
  getScenarioName,
  readRunAccuracy,
  readRunDurationMs,
  readRunScore,
  readRunTimestamp,
} from "./scenarios";

function makeRun(
  summary: Record<string, unknown> = {},
  fileName = "",
): RunRecord {
  return {
    fileName,
    stats: { summary },
  } as unknown as RunRecord;
}

describe("getScenarioName", () => {
  it("prefers a non-empty scenario name from the stats summary", () => {
    expect(
      getScenarioName(
        makeRun({ scenario: "  Tile Frenzy  " }, "Other Scenario - run.csv"),
      ),
    ).toBe("Tile Frenzy");
  });

  it("falls back to the first part of the run filename", () => {
    expect(
      getScenarioName(makeRun({}, "  Tile Frenzy - 2026.01.01 - Stats.csv  ")),
    ).toBe("Tile Frenzy");
  });

  it("returns the trimmed filename when it has no run suffix", () => {
    expect(getScenarioName(makeRun({}, "  Tile Frenzy  "))).toBe("Tile Frenzy");
    expect(getScenarioName({})).toBe("");
  });
});

describe("readRunTimestamp", () => {
  it("parses a valid timestamp and returns zero for missing or invalid dates", () => {
    const expected = Date.parse("2026-04-03T12:30:00.000Z");
    expect(
      readRunTimestamp(makeRun({ datePlayed: "2026-04-03T12:30:00.000Z" })),
    ).toBe(expected);
    expect(readRunTimestamp(makeRun())).toBe(0);
    expect(readRunTimestamp(makeRun({ datePlayed: "not a date" }))).toBe(0);
  });
});

describe("readRunScore", () => {
  it("parses numeric strings with thousands separators", () => {
    expect(readRunScore(makeRun({ score: "12,345.6" }))).toBe(12345.6);
  });

  it("defaults invalid and non-finite scores to zero", () => {
    expect(readRunScore(makeRun({ score: "unknown" }))).toBe(0);
    expect(readRunScore(makeRun({ score: Number.POSITIVE_INFINITY }))).toBe(0);
  });
});

describe("readRunAccuracy", () => {
  it("normalizes ratios to percentages and preserves percentage values", () => {
    expect(readRunAccuracy(makeRun({ accuracy: 0.85 }))).toBe(85);
    expect(readRunAccuracy(makeRun({ accuracy: "0.85" }))).toBe(85);
    expect(readRunAccuracy(makeRun({ accuracy: "85%" }))).toBe(85);
    expect(readRunAccuracy(makeRun({ accuracy: 85 }))).toBe(85);
    expect(readRunAccuracy(makeRun({ accuracy: 0 }))).toBe(0);
  });

  it("returns null when accuracy is missing or invalid", () => {
    expect(readRunAccuracy(makeRun())).toBeNull();
    expect(readRunAccuracy(makeRun({ accuracy: "unknown" }))).toBeNull();
  });
});

describe("readRunDurationMs", () => {
  it("converts numeric seconds to milliseconds", () => {
    expect(readRunDurationMs(makeRun({ duration: 12.5 }))).toBe(12500);
    expect(readRunDurationMs(makeRun({ duration: "12.5" }))).toBe(12500);
  });

  it("parses minute-second and hour-minute-second duration strings", () => {
    expect(readRunDurationMs(makeRun({ duration: "01:02" }))).toBe(62000);
    expect(readRunDurationMs(makeRun({ duration: "1:02:03.5" }))).toBe(3723500);
  });

  it("uses scenarioTime and time when duration is absent", () => {
    expect(readRunDurationMs(makeRun({ scenarioTime: 30 }))).toBe(30000);
    expect(readRunDurationMs(makeRun({ time: 45 }))).toBe(45000);
  });

  it("returns zero for invalid or non-positive durations", () => {
    expect(readRunDurationMs(makeRun({ duration: "1:x" }))).toBe(0);
    expect(readRunDurationMs(makeRun({ duration: -1 }))).toBe(0);
    expect(readRunDurationMs(makeRun())).toBe(0);
  });
});

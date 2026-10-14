import { describe, expect, it } from "vitest";
import type {
  MousePoint,
  RunPerformanceEvent,
  RunPerformanceHeader,
} from "@/shared/types";
import { computeTargetInference } from "./targetInference";

const CHALLENGE_START = 1_700_000_000_000;

function makeHeader(): RunPerformanceHeader {
  return {
    scenarioName: "Test scenario",
    scenarioHash: "hash",
    challengeStartUtc: CHALLENGE_START,
    schemaVersion: 1,
    challengeProfile: {},
  } as unknown as RunPerformanceHeader;
}

function makePoints(): MousePoint[] {
  return Array.from({ length: 11 }, (_, index) => ({
    ts: CHALLENGE_START + index * 100,
    x: index * 10,
    y: 0,
  }));
}

function makeHitEvent(): RunPerformanceEvent {
  return { timestamp: 1, payloadType: "shotsHit", count: 1 };
}

describe("computeTargetInference", () => {
  it("returns no frames when required trace or performance data is missing", () => {
    expect(computeTargetInference(makePoints(), undefined, [makeHitEvent()], null)).toEqual(
      [],
    );
    expect(
      computeTargetInference(makePoints().slice(0, 1), makeHeader(), [makeHitEvent()], null),
    ).toEqual([]);
    expect(computeTargetInference(makePoints(), makeHeader(), [], null)).toEqual(
      [],
    );
  });

  it("produces finite, visible target frames from confirmed hit evidence", () => {
    const frames = computeTargetInference(
      makePoints(),
      makeHeader(),
      [makeHitEvent()],
      null,
    );

    expect(frames).toHaveLength(11);
    expect(frames.every((frame) => frame !== null)).toBe(true);
    for (const frame of frames) {
      expect(frame).not.toBeNull();
      expect(Number.isFinite(frame!.x)).toBe(true);
      expect(Number.isFinite(frame!.y)).toBe(true);
      expect(frame!.alpha).toBeGreaterThan(0);
      expect(frame!.alpha).toBeLessThanOrEqual(0.92);
    }
  });
});

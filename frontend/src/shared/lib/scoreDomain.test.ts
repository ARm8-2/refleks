import { describe, expect, it } from "vitest";
import {
  buildScoreDomain,
  buildThresholdAnchoredScoreDomain,
} from "./scoreDomain";

describe("buildScoreDomain", () => {
  it("returns the default domain when all values are missing or invalid", () => {
    expect(buildScoreDomain([])).toEqual([0, 1]);
    expect(buildScoreDomain([0, -10, Number.NaN], [Number.POSITIVE_INFINITY])).toEqual([
      0, 1,
    ]);
  });

  it("pads a flat score range without allowing a negative lower bound", () => {
    expect(buildScoreDomain([10, 10])).toEqual([9, 11]);
    expect(buildScoreDomain([1])).toEqual([0, 2]);
  });

  it("uses scores and reference scores to pad a non-flat range", () => {
    expect(buildScoreDomain([100], [200])).toEqual([82, 218]);
  });
});

describe("buildThresholdAnchoredScoreDomain", () => {
  it("anchors the range to nearby benchmark thresholds", () => {
    expect(buildThresholdAnchoredScoreDomain([130, 170], [300, 100, 200])).toEqual([
      88, 212,
    ]);
  });

  it("focuses on the observed scores when surrounding thresholds are too broad", () => {
    expect(buildThresholdAnchoredScoreDomain([400, 410], [0, 1000])).toEqual([
      399, 411,
    ]);
  });

  it("returns the default domain when there are no positive finite scores", () => {
    expect(buildThresholdAnchoredScoreDomain([0, -1, Number.NaN], [10, 20])).toEqual([
      0, 1,
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { autoHiddenRanks } from "./detailVisibility";

describe("autoHiddenRanks", () => {
  it("does not hide ranks when disabled or when there are no usable ranks", () => {
    expect(autoHiddenRanks(5, [3, 4], false, 2)).toEqual(new Set());
    expect(autoHiddenRanks(0, [3, 4], true, 2)).toEqual(new Set());
    expect(autoHiddenRanks(5, [], true, 2)).toEqual(new Set());
    expect(autoHiddenRanks(5, [0, 4], true, 2)).toEqual(new Set());
  });

  it("hides only ranks below the lowest achieved scenario rank", () => {
    expect(autoHiddenRanks(5, [4, 2, 3], true, 2)).toEqual(
      new Set([0, 1]),
    );
  });

  it("never hides every rank and keeps the requested number visible", () => {
    expect(autoHiddenRanks(5, [5, 5], true, 1)).toEqual(
      new Set([0, 1, 2, 3]),
    );
  });

  it("clamps the target visible count to the available rank range", () => {
    expect(autoHiddenRanks(4, [3, 3], true, 0)).toEqual(new Set([0, 1, 2]));
    expect(autoHiddenRanks(4, [3, 3], true, 20)).toEqual(new Set());
  });
});

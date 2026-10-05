import { beforeEach, describe, expect, it } from "vitest";
import { applyLocale } from "@/shared/lib/i18n/core";
import {
  adjustColorForTheme,
  cellFill,
  computeFillColor,
  formatNumber,
  normalizedRankProgress,
} from "./detailFormatting";

beforeEach(() => {
  applyLocale("en");
});

describe("adjustColorForTheme", () => {
  it("moves a color toward the target lightness for a light background", () => {
    expect(adjustColorForTheme("#ff0000", "#ffffff", 1)).toBe("rgb(204, 0, 0)");
  });

  it("leaves invalid colors unchanged instead of returning a broken value", () => {
    expect(adjustColorForTheme("  not-a-color  ", "#ffffff")).toBe(
      "not-a-color",
    );
  });
});

describe("formatNumber", () => {
  it("formats numbers using the active locale and requested precision", () => {
    expect(formatNumber(1234.5, 1)).toBe("1,234.5");
    expect(formatNumber(1234.5, 2, false)).toBe("1,234.50");
    expect(formatNumber("12.345", 2)).toBe("12.35");
  });

  it("uses the localized missing-value message for absent or invalid input", () => {
    expect(formatNumber(null)).toBe("N/A");
    expect(formatNumber("")).toBe("N/A");
    expect(formatNumber("not a number")).toBe("N/A");
    expect(formatNumber(Number.NaN)).toBe("N/A");
  });
});

describe("computeFillColor", () => {
  const ranks = [{ color: "red" }, { color: "blue" }];

  it("maps one-based achieved ranks to their colors and caps at the last rank", () => {
    expect(computeFillColor(1, ranks)).toBe("red");
    expect(computeFillColor(2, ranks)).toBe("blue");
    expect(computeFillColor(99, ranks)).toBe("blue");
  });

  it("uses the fallback for unranked values and missing rank colors", () => {
    expect(computeFillColor(0, ranks)).toBe("var(--surface-muted-foreground)");
    expect(computeFillColor(null, ranks, "gray")).toBe("gray");
    expect(computeFillColor(1, [{}], "gray")).toBe("gray");
  });
});

describe("cellFill", () => {
  it("returns the fraction between adjacent thresholds, clamped to the cell", () => {
    expect(cellFill(0, 50, [0, 100])).toBe(0.5);
    expect(cellFill(0, -10, [0, 100])).toBe(0);
    expect(cellFill(0, 120, [0, 100])).toBe(1);
  });

  it("handles missing or non-increasing threshold ranges", () => {
    expect(cellFill(0, 50, [100])).toBe(0);
    expect(cellFill(0, 100, [100, 100])).toBe(1);
    expect(cellFill(0, 99, [100, 100])).toBe(0);
  });
});

describe("normalizedRankProgress", () => {
  it("combines current rank and score progress into a zero-to-one value", () => {
    expect(normalizedRankProgress(0, 50, [0, 100, 200])).toBe(0.25);
    expect(normalizedRankProgress(1, 150, [0, 100, 200])).toBe(0.25);
    expect(normalizedRankProgress(2, 200, [0, 100, 200])).toBe(1);
  });

  it("clamps out-of-range progress and handles missing or degenerate thresholds", () => {
    expect(normalizedRankProgress(0, -10, [0, 100])).toBe(0);
    expect(normalizedRankProgress(0, 200, [0, 100])).toBe(1);
    expect(normalizedRankProgress(0, 10, [])).toBe(0);
    expect(normalizedRankProgress(0, 10, [100, 100])).toBe(0);
  });
});

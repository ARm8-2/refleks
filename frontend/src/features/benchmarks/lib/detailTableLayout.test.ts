import { describe, expect, it } from "vitest";
import { buildLeftColumns, buildRightGridLayout } from "./detailTableLayout";

describe("buildLeftColumns", () => {
  it("includes only fixed scenario, padding, and score columns when actions are hidden", () => {
    expect(
      buildLeftColumns({
        scenarioWidth: 251.6,
        showNotesCol: false,
        showRecCol: false,
        showPlayCol: false,
        showHistoryCol: false,
      }),
    ).toBe("252px 10px 10px 88px");
  });

  it("includes action columns in the configured order", () => {
    expect(
      buildLeftColumns({
        scenarioWidth: 260,
        showNotesCol: true,
        showRecCol: true,
        showPlayCol: true,
        showHistoryCol: true,
      }),
    ).toBe("260px 10px 36px 28px 36px 36px 10px 88px");
  });
});

describe("buildRightGridLayout", () => {
  it("adds one minimum-width column per visible rank and an energy column", () => {
    expect(buildRightGridLayout(2, true)).toEqual({
      templateColumns:
        "minmax(120px, 1fr) minmax(120px, 1fr) minmax(92px, 1fr)",
      minWidth: 332,
    });
  });

  it("keeps a rank column when no ranks or energy are visible", () => {
    expect(buildRightGridLayout(0, false)).toEqual({
      templateColumns: "minmax(120px, 1fr)",
      minWidth: 120,
    });
  });

  it("allows an energy-only layout when no ranks are visible", () => {
    expect(buildRightGridLayout(0, true)).toEqual({
      templateColumns: "minmax(92px, 1fr)",
      minWidth: 92,
    });
  });
});

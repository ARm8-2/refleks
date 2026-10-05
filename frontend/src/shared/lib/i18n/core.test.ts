import { afterEach, describe, expect, it } from "vitest";
import {
  applyLocale,
  isLocale,
  resolveLocale,
  translate,
  type MessageKey,
} from "./core";

afterEach(() => {
  applyLocale("en");
});

describe("resolveLocale", () => {
  it("normalizes language tags and resolves supported base languages", () => {
    expect(resolveLocale(" ES_mx ")).toBe("es");
    expect(resolveLocale("nl-NL")).toBe("nl");
    expect(resolveLocale("zh-cn")).toBe("zh-CN");
  });

  it("uses English when the input is missing or unsupported", () => {
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("fr-CA")).toBe("en");
    expect(resolveLocale(42 as unknown as string)).toBe("en");
  });
});

describe("locale state and translation", () => {
  it("recognizes registered locales and changes the active catalog", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);

    applyLocale("es");
    expect(translate("common.nav.overview")).toBe("Resumen");
  });

  it("substitutes parameters and plural counts", () => {
    expect(
      translate("benchmarks.rankDistribution.descriptionCategory", {
        name: "Clicking",
      }),
    ).toBe("Category scope: Clicking");
    expect(translate("history.page.runs", { count: 1 })).toBe("1 run");
    expect(translate("history.page.runs", { count: 3 })).toBe("3 runs");
  });

  it("preserves missing placeholders and returns unknown keys as-is", () => {
    expect(translate("benchmarks.rankDistribution.descriptionCategory"))
      .toBe("Category scope: {name}");
    expect(translate("not.a.real.message" as MessageKey)).toBe(
      "not.a.real.message",
    );
  });
});

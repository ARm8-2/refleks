import { act, renderHook } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { changeAppLanguage, initializeI18n } from ".";
import { createLocaleFormatters } from "./format";
import { useLocaleFormat } from "./useLocaleFormat";

beforeAll(async () => {
  await initializeI18n("en");
});

describe("locale formatters", () => {
  const input = new Date("2026-08-07T12:34:56Z");

  it("uses explicit English and Simplified Chinese locales", () => {
    const english = createLocaleFormatters("en");
    const chinese = createLocaleFormatters("zh-CN");
    expect(english.locale).toBe("en-US");
    expect(chinese.locale).toBe("zh-CN");
    expect(
      english.formatDate(input, { dateStyle: "medium", timeZone: "UTC" }),
    ).toBe("Aug 7, 2026");
    expect(
      chinese.formatDate(input, { dateStyle: "medium", timeZone: "UTC" }),
    ).toBe("2026年8月7日");
  });

  it("formats duration without changing the source value", () => {
    const seconds = 3723;
    expect(createLocaleFormatters("en").formatDuration(seconds)).toContain("1 hr");
    expect(createLocaleFormatters("zh-CN").formatDuration(seconds)).toContain("1小时");
    expect(seconds).toBe(3723);
  });

  it("provides locale plural and translated-label collation", () => {
    const english = createLocaleFormatters("en");
    expect(english.selectPlural(1)).toBe("one");
    expect(english.selectPlural(2)).toBe("other");
    expect(["Zulu", "Alpha"].sort(english.collator().compare)).toEqual([
      "Alpha",
      "Zulu",
    ]);
  });

  it("updates the hook when the application language changes", async () => {
    const { result } = renderHook(() => useLocaleFormat());
    expect(result.current.locale).toBe("en-US");
    await act(async () => changeAppLanguage("zh-CN"));
    expect(result.current.locale).toBe("zh-CN");
    await act(async () => changeAppLanguage("en"));
  });
});

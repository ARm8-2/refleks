import { describe, expect, it } from "vitest";
import {
  detectInitialLanguage,
  isAppLanguage,
  toIntlLocale,
} from "./locale";

describe("locale selection", () => {
  it.each(["zh", "zh-CN", "zh-TW", "zh_HK"])(
    "maps %s to Simplified Chinese",
    (language) => expect(detectInitialLanguage(language)).toBe("zh-CN"),
  );

  it.each(["en-US", "ja-JP", "", "fr"])("maps %s to English", (language) =>
    expect(detectInitialLanguage(language)).toBe("en"),
  );

  it("accepts only persisted languages", () => {
    expect(isAppLanguage("en")).toBe(true);
    expect(isAppLanguage("zh-CN")).toBe(true);
    expect(isAppLanguage("system")).toBe(false);
    expect(isAppLanguage("")).toBe(false);
  });

  it("maps storage languages to explicit Intl locales", () => {
    expect(toIntlLocale("en")).toBe("en-US");
    expect(toIntlLocale("zh-CN")).toBe("zh-CN");
  });
});

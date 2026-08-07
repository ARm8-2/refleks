import type { Settings } from "@/shared/types";
import { describe, expect, it } from "vitest";
import { preserveLanguageAfterReset } from "./resetSettingsState";

const settings = {
  kovaaksInstallDir: "",
  sessionGapMinutes: 20,
  recentRunsDays: 180,
  recentRunsMinCount: 2500,
  theme: "dark",
  font: "montserrat",
} satisfies Settings;

describe("preserveLanguageAfterReset", () => {
  it("keeps the last committed language instead of detecting the system again", () => {
    const reset = preserveLanguageAfterReset(
      settings,
      { ...settings, language: "zh-CN" },
      "en",
    );
    expect(reset.language).toBe("zh-CN");
  });

  it("keeps a language returned by the backend reset", () => {
    const reset = preserveLanguageAfterReset(
      { ...settings, language: "en" },
      { ...settings, language: "zh-CN" },
      "zh-CN",
    );
    expect(reset.language).toBe("en");
  });
});

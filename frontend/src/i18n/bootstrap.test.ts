import type { Settings } from "@/shared/types";
import { describe, expect, it, vi } from "vitest";
import { resolveStartupLanguage } from "./bootstrap";

const settings = {
  kovaaksInstallDir: "",
  sessionGapMinutes: 20,
  recentRunsDays: 180,
  recentRunsMinCount: 2500,
  theme: "dark",
  font: "montserrat",
} satisfies Settings;

describe("resolveStartupLanguage", () => {
  it("uses a stored language without reading the system language", async () => {
    const getSystemLanguage = vi.fn(() => "zh-CN");
    const writeSettings = vi.fn(async () => {});

    await expect(
      resolveStartupLanguage({
        readSettings: async () => ({ ...settings, language: "en" }),
        writeSettings,
        getSystemLanguage,
      }),
    ).resolves.toBe("en");
    expect(getSystemLanguage).not.toHaveBeenCalled();
    expect(writeSettings).not.toHaveBeenCalled();
  });

  it("detects and persists Chinese once when language is uninitialized", async () => {
    const writeSettings = vi.fn(async () => {});
    await expect(
      resolveStartupLanguage({
        readSettings: async () => settings,
        writeSettings,
        getSystemLanguage: () => "zh-TW",
      }),
    ).resolves.toBe("zh-CN");
    expect(writeSettings).toHaveBeenCalledWith({ ...settings, language: "zh-CN" });
  });

  it("uses the detected language for the session when persistence fails", async () => {
    const logError = vi.fn();
    await expect(
      resolveStartupLanguage({
        readSettings: async () => settings,
        writeSettings: async () => {
          throw new Error("read only");
        },
        getSystemLanguage: () => "ja-JP",
        logError,
      }),
    ).resolves.toBe("en");
    expect(logError).toHaveBeenCalledOnce();
  });

  it("falls back to English without writing when Settings times out", async () => {
    const writeSettings = vi.fn(async () => {});
    const logError = vi.fn();
    await expect(
      resolveStartupLanguage({
        readSettings: () => new Promise<Settings>(() => {}),
        writeSettings,
        getSystemLanguage: () => "zh-CN",
        logError,
        timeoutMs: 5,
      }),
    ).resolves.toBe("en");
    expect(writeSettings).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledOnce();
  });
});

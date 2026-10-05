import { afterEach, describe, expect, it } from "vitest";
import type { Settings } from "@/shared/types";
import { applyLocale } from "@/shared/lib/i18n/core";
import {
  buildManualWelcomePresentation,
  buildVersionWelcomePresentation,
  buildWelcomeSeenSettingsUpdate,
  buildWelcomeSettingsUpdate,
} from "./presentation";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    kovaaksInstallDir: "",
    sessionGapMinutes: 30,
    recentRunsDays: 30,
    recentRunsMinCount: 10,
    theme: "dark",
    font: "default",
    scale: "default",
    language: "en",
    ...overrides,
  } as Settings;
}

afterEach(() => {
  applyLocale("en");
});

describe("buildVersionWelcomePresentation", () => {
  it("shows first-launch choices when no prior version is saved", () => {
    const presentation = buildVersionWelcomePresentation(
      makeSettings({ anonymousEnabled: true, mouseTrackingEnabled: true }),
      " 1.2.3 ",
    );

    expect(presentation).not.toBeNull();
    expect(presentation).toMatchObject({
      currentVersion: "1.2.3",
      showMouseTraceChoice: true,
      showScreenCaptureChoice: true,
      showAnonymousChoice: true,
      initialAnonymousEnabled: true,
      initialMouseTrackingEnabled: true,
      initialScreenCaptureEnabled: false,
      runSyncEnabled: true,
    });
    expect(presentation?.content.title).toBe("Welcome to RefleK's v1.2.3");
  });

  it("shows upgrade content without first-launch choices for a changed version", () => {
    const presentation = buildVersionWelcomePresentation(
      makeSettings({
        lastSeenVersion: "1.2.2",
        screenCaptureEnabled: true,
        runSyncEnabled: false,
      }),
      "1.2.3",
    );

    expect(presentation).not.toBeNull();
    expect(presentation).toMatchObject({
      showMouseTraceChoice: false,
      showScreenCaptureChoice: false,
      showAnonymousChoice: false,
      initialScreenCaptureEnabled: true,
      runSyncEnabled: false,
    });
    expect(presentation?.content.title).toBe(
      "Welcome back to RefleK's v1.2.3",
    );
  });

  it("does not show for a blank or already-seen version", () => {
    expect(
      buildVersionWelcomePresentation(makeSettings(), "   "),
    ).toBeNull();
    expect(
      buildVersionWelcomePresentation(
        makeSettings({ lastSeenVersion: " 1.2.3 " }),
        "1.2.3",
      ),
    ).toBeNull();
  });
});

describe("buildManualWelcomePresentation", () => {
  it("shows the current version without first-launch choices when opened manually", () => {
    const presentation = buildManualWelcomePresentation(
      makeSettings(),
      " 1.2.3 ",
    );

    expect(presentation).not.toBeNull();
    expect(presentation).toMatchObject({
      currentVersion: "1.2.3",
      showMouseTraceChoice: false,
      showScreenCaptureChoice: false,
      showAnonymousChoice: false,
    });
  });

  it("returns null for a blank version", () => {
    expect(buildManualWelcomePresentation(makeSettings(), " ")).toBeNull();
  });
});

describe("welcome settings updates", () => {
  it("records a nonblank version without mutating the original settings", () => {
    const settings = makeSettings({ lastSeenVersion: "1.2.2" });
    const updated = buildWelcomeSeenSettingsUpdate(settings, " 1.2.3 ");

    expect(updated).not.toBe(settings);
    expect(updated.lastSeenVersion).toBe("1.2.3");
    expect(settings.lastSeenVersion).toBe("1.2.2");
    expect(buildWelcomeSeenSettingsUpdate(settings, " ")).toBe(settings);
  });

  it("applies explicit choices and preserves omitted optional choices", () => {
    const settings = makeSettings({
      anonymousEnabled: true,
      mouseTrackingEnabled: true,
      screenCaptureEnabled: false,
      favoriteBenchmarks: ["benchmark-1"],
    });
    const updated = buildWelcomeSettingsUpdate(settings, {
      anonymousEnabled: false,
      mouseTrackingEnabled: null,
      screenCaptureEnabled: true,
    });

    expect(updated).toMatchObject({
      anonymousEnabled: false,
      mouseTrackingEnabled: true,
      screenCaptureEnabled: true,
      favoriteBenchmarks: ["benchmark-1"],
    });
    expect(settings).toMatchObject({
      anonymousEnabled: true,
      mouseTrackingEnabled: true,
      screenCaptureEnabled: false,
    });
  });
});

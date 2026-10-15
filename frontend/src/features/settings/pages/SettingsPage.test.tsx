// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { StoreProvider } from "@/shared/hooks";
import {
  getScreenCaptureInfo,
  getSettings,
  getVersion,
  updateSettings,
} from "@/shared/lib";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import type { ScreenCaptureInfo, Settings } from "@/shared/types";
import { SettingsPage } from "./SettingsPage";

vi.mock("@/shared/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/hooks")>();
  return { ...actual, useAvailableUpdate: () => null };
});

vi.mock("@/shared/lib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib")>();
  return {
    ...actual,
    getScreenCaptureInfo: vi.fn(),
    getSettings: vi.fn(),
    getVersion: vi.fn(),
    updateSettings: vi.fn(),
  };
});

const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  if (originalScrollIntoView) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.motionPreference;
});

const settings: Settings = {
  kovaaksInstallDir: "C:/Games/Kovaaks",
  sessionGapMinutes: 30,
  recentRunsDays: 30,
  recentRunsMinCount: 10,
  theme: "dark",
  font: "montserrat",
  scale: "100",
  language: "en",
  motionPreference: "system",
};

const captureInfo: ScreenCaptureInfo = {
  encoderName: "",
  container: "mp4",
  isHardware: false,
  available: false,
  active: false,
  healthy: false,
  state: "unavailable",
  message: "FFmpeg is unavailable",
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
  vi.mocked(getScreenCaptureInfo).mockResolvedValue(captureInfo);
  vi.mocked(getSettings).mockResolvedValue(settings);
  vi.mocked(getVersion).mockResolvedValue("1.2.3");
  vi.mocked(updateSettings).mockResolvedValue(undefined);
});

describe("SettingsPage", () => {
  it("loads settings and saves a changed session gap", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <StoreProvider>
          <SettingsPage />
        </StoreProvider>
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(getSettings).toHaveBeenCalledOnce();
    expect(getVersion).toHaveBeenCalledOnce();
    expect(getScreenCaptureInfo).toHaveBeenCalledOnce();

    const sessionGapLabel = screen.getByText("Session Gap");
    const field = sessionGapLabel.parentElement;
    expect(field).not.toBeNull();
    const sessionGapSelect = within(field as HTMLElement).getByRole("combobox");
    sessionGapSelect.focus();
    await user.keyboard("{Enter}{ArrowUp}{Enter}");

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ sessionGapMinutes: 20 }),
    );
  });

  it("saves and applies a changed motion preference", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <StoreProvider>
          <SettingsPage />
        </StoreProvider>
      </I18nProvider>,
    );

    const motionField = (await screen.findByText("Motion")).parentElement;
    expect(motionField).not.toBeNull();
    const motionSelect = within(motionField as HTMLElement).getByRole(
      "combobox",
    );
    motionSelect.focus();
    await user.keyboard("{Enter}{ArrowDown}{ArrowDown}{Enter}");

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ motionPreference: "full" }),
    );
    expect(window.localStorage.getItem(STORAGE_KEYS.motionPreference)).toBe(
      "full",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-motion-preference",
      "full",
    );
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, getVersion, updateSettings } from "@/shared/lib";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import type { Settings } from "@/shared/types";
import { VersionWelcomeGate } from "./VersionWelcomeGate";

vi.mock("@/shared/lib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib")>();
  return {
    ...actual,
    getSettings: vi.fn(),
    getVersion: vi.fn(),
    updateSettings: vi.fn(),
  };
});

afterEach(() => cleanup());

const settings: Settings = {
  kovaaksInstallDir: "",
  sessionGapMinutes: 30,
  recentRunsDays: 30,
  recentRunsMinCount: 10,
  theme: "dark",
  font: "montserrat",
  scale: "100",
  language: "en",
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
  vi.mocked(getSettings).mockResolvedValue(settings);
  vi.mocked(getVersion).mockResolvedValue("1.2.3");
  vi.mocked(updateSettings).mockResolvedValue(undefined);
});

describe("VersionWelcomeGate", () => {
  it("shows first-launch setup and saves the confirmed choices with the version", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <VersionWelcomeGate />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("dialog", {
        name: "Welcome to RefleK's v1.2.3",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start exploring" }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledOnce());
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousEnabled: false,
        mouseTrackingEnabled: false,
        screenCaptureEnabled: false,
        lastSeenVersion: "1.2.3",
      }),
    );
  });
});

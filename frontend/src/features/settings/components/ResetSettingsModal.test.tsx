// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { resetSettings } from "@/shared/lib";
import { ResetSettingsModal } from "./ResetSettingsModal";

vi.mock("@/shared/lib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib")>();
  return { ...actual, resetSettings: vi.fn() };
});

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
  vi.mocked(resetSettings).mockReset();
  vi.mocked(resetSettings).mockResolvedValue(undefined);
});

describe("ResetSettingsModal", () => {
  it("passes selected reset options and calls the success callbacks", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <ResetSettingsModal isOpen onReset={onReset} onClose={onClose} />
      </I18nProvider>,
    );

    const configOption = screen.getByRole("checkbox", {
      name: "Settings & Configuration",
    });
    const favoritesOption = screen.getByRole("checkbox", {
      name: "Favorite Scenarios",
    });
    const sessionNotesOption = screen.getByRole("checkbox", {
      name: "Session Notes",
    });

    expect(configOption).toBeChecked();
    expect(favoritesOption).not.toBeChecked();
    expect(sessionNotesOption).not.toBeChecked();

    await user.click(favoritesOption);
    await user.click(sessionNotesOption);
    await user.click(screen.getByRole("button", { name: "Reset Selected" }));

    expect(resetSettings).toHaveBeenCalledWith(true, true, false, true);
    expect(onReset).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

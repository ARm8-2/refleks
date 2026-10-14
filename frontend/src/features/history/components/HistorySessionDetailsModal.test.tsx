// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { HistorySessionDetailsModal } from "./HistorySessionDetailsModal";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

describe("HistorySessionDetailsModal", () => {
  it("saves edited session notes and closes after a successful save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <HistorySessionDetailsModal
          isOpen
          sessionLabel="Today · 4 runs"
          initialNotes="Warm up first"
          onSave={onSave}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    const notes = screen.getByRole("textbox", { name: "Notes" });
    await user.clear(notes);
    await user.type(notes, "Focus on smooth tracking");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("Focus on smooth tracking");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the modal open and reports an error when saving fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("storage unavailable"));
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <HistorySessionDetailsModal
          isOpen
          sessionLabel="Today · 4 runs"
          initialNotes=""
          onSave={onSave}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    await user.type(
      screen.getByRole("textbox", { name: "Notes" }),
      "Add tracking notes",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Failed to save session notes. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith("Add tracking notes");
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Session Notes" }),
    ).toBeInTheDocument();
  });
});

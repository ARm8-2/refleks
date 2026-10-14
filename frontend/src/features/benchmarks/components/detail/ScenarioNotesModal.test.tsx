// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { ScenarioNotesModal } from "./ScenarioNotesModal";

let clipboardDescriptor: PropertyDescriptor | undefined;
let shouldRestoreClipboard = false;

afterEach(() => {
  cleanup();
  if (!shouldRestoreClipboard) return;
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  clipboardDescriptor = undefined;
  shouldRestoreClipboard = false;
});

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

describe("ScenarioNotesModal", () => {
  it("saves the edited training sensitivity and notes together", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <ScenarioNotesModal
          isOpen
          scenarioName="Scenario Alpha"
          initialNotes="Track smoothness"
          initialSensitivity="35 cm"
          onSave={onSave}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    const sensitivity = screen.getByRole("textbox", {
      name: "Training Sensitivity",
    });
    const notes = screen.getByRole("textbox", { name: "Notes" });
    await user.clear(sensitivity);
    await user.type(sensitivity, "40 cm");
    await user.clear(notes);
    await user.type(notes, "Keep the crosshair steady");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("Keep the crosshair steady", "40 cm");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("copies the current sensitivity value", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    shouldRestoreClipboard = true;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <I18nProvider>
        <ScenarioNotesModal
          isOpen
          scenarioName="Scenario Alpha"
          initialNotes=""
          initialSensitivity="35 cm"
          onSave={vi.fn().mockResolvedValue(undefined)}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Copy sensitivity" }));

    expect(writeText).toHaveBeenCalledWith("35 cm");
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { InfoTooltip } from "./InfoTooltip";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

describe("InfoTooltip", () => {
  it("exposes an accessible trigger and reveals its content on focus", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <InfoTooltip ariaLabel="More information">
          Helpful explanation
        </InfoTooltip>
      </I18nProvider>,
    );

    const trigger = screen.getByRole("button", { name: "More information" });
    expect(trigger).toBeInTheDocument();

    await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Helpful explanation",
    );
  });
});

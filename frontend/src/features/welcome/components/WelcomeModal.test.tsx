// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import type { WelcomeContent } from "../lib/content";
import { WelcomeModal } from "./WelcomeModal";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

const content: WelcomeContent = {
  title: "Welcome",
  intro: "Welcome to the app.",
  details: [],
  highlightsTitle: "Getting Started",
  highlights: [],
  linksTitle: "Resources",
  links: [],
  ctaLabel: "Continue",
};

describe("WelcomeModal", () => {
  it("submits the selected privacy, mouse trace, and screen replay choices", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nProvider>
        <WelcomeModal
          isOpen
          content={content}
          initialAnonymousEnabled={false}
          initialMouseTrackingEnabled={true}
          initialScreenCaptureEnabled={false}
          showAnonymousChoice
          showMouseTraceChoice
          showScreenCaptureChoice
          runSyncEnabled
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: /^Private Anonymous/ }),
    );
    await user.click(screen.getByRole("button", { name: /Not Right Now/ }));
    await user.click(
      screen.getByRole("button", { name: /Enable Replay Recording/ }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onConfirm).toHaveBeenCalledWith({
      anonymousEnabled: true,
      mouseTrackingEnabled: false,
      screenCaptureEnabled: true,
    });
  });

  it("preserves hidden optional choices as null in the confirmation payload", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nProvider>
        <WelcomeModal
          isOpen
          content={content}
          initialAnonymousEnabled
          initialMouseTrackingEnabled
          initialScreenCaptureEnabled
          runSyncEnabled={false}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onConfirm).toHaveBeenCalledWith({
      anonymousEnabled: true,
      mouseTrackingEnabled: null,
      screenCaptureEnabled: null,
    });
  });
});

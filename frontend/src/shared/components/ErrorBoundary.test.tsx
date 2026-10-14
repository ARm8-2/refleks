// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, translate } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { ErrorBoundary } from "./ErrorBoundary";

function suppressExpectedRenderError(event: Event) {
  if (event instanceof ErrorEvent && event.message === "render failed") {
    event.preventDefault();
  }
}

afterEach(() => {
  cleanup();
  window.removeEventListener("error", suppressExpectedRenderError);
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
  window.addEventListener("error", suppressExpectedRenderError);
});

function FailingChild({ shouldFail }: { shouldFail: boolean }) {
  if (shouldFail) throw new Error("render failed");
  return <p>Recovered content</p>;
}

describe("ErrorBoundary", () => {
  it("renders children normally when they do not throw", () => {
    render(
      <I18nProvider>
        <ErrorBoundary>
          <p>Healthy content</p>
        </ErrorBoundary>
      </I18nProvider>,
    );

    expect(screen.getByText("Healthy content")).toBeInTheDocument();
  });

  it("shows the fallback and can recover after the child is fixed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    function Harness() {
      const [shouldFail, setShouldFail] = useState(true);
      return (
        <>
          <button onClick={() => setShouldFail(false)}>Fix child</button>
          <ErrorBoundary>
            <FailingChild shouldFail={shouldFail} />
          </ErrorBoundary>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );

    expect(screen.getByText("render failed")).toBeInTheDocument();
    const dismiss = translate("common.errorBoundary.dismiss");
    expect(screen.getByRole("button", { name: dismiss })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fix child" }));
    await user.click(screen.getByRole("button", { name: dismiss }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, translate } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { Widget } from "./Widget";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

describe("Widget", () => {
  it("opens its expanded modal from the expand action", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Widget
          title="Accuracy"
          modalContent={<p>Expanded chart</p>}
        >
          <p>Compact chart</p>
        </Widget>
      </I18nProvider>,
    );

    expect(screen.queryByText("Expanded chart")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: translate("common.widget.expand"),
      }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Accuracy" }),
    ).toHaveTextContent("Expanded chart");
  });

  it("supports opening the expanded view with Enter on the widget", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Widget title="Accuracy" modalContent={<p>Expanded chart</p>}>
          <p>Compact chart</p>
        </Widget>
      </I18nProvider>,
    );

    const widget = screen.getByRole("button", { name: /Accuracy/ });
    widget.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("dialog", { name: "Accuracy" }),
    ).toHaveTextContent("Expanded chart");
  });

  it("does not expand when a header control is used", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Widget
          title="Accuracy"
          headerAction={<button type="button">Refresh</button>}
          titleControls={<button type="button">Change metric</button>}
          modalContent={<p>Expanded chart</p>}
        >
          <p>Compact chart</p>
        </Widget>
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await user.click(screen.getByRole("button", { name: "Change metric" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not expose expand controls when no modal content is provided", () => {
    render(
      <I18nProvider>
        <Widget title="Static widget">
          <p>Widget content</p>
        </Widget>
      </I18nProvider>,
    );

    expect(screen.getByText("Widget content")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: translate("common.widget.expand"),
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Static widget/ })).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SegmentedControl } from "./segmented-control";

afterEach(() => cleanup());

const options = [
  { value: "overview", label: "Overview" },
  { value: "history", label: "History" },
  { value: "disabled", label: "Unavailable", disabled: true },
];

function ControlledSegmentedControl() {
  const [value, setValue] = useState("overview");
  return (
    <SegmentedControl
      value={value}
      options={options}
      onValueChange={setValue}
    />
  );
}

describe("SegmentedControl", () => {
  it("updates the selected tab after a user click", async () => {
    const user = userEvent.setup();
    render(<ControlledSegmentedControl />);

    const overview = screen.getByRole("tab", { name: "Overview" });
    const history = screen.getByRole("tab", { name: "History" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(history).toHaveAttribute("aria-selected", "false");

    await user.click(history);

    expect(overview).toHaveAttribute("aria-selected", "false");
    expect(history).toHaveAttribute("aria-selected", "true");
  });

  it("supports selecting the next tab with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ControlledSegmentedControl />);

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("does not select a disabled option", async () => {
    const user = userEvent.setup();
    render(<ControlledSegmentedControl />);

    const disabled = screen.getByRole("tab", { name: "Unavailable" });
    expect(disabled).toBeDisabled();

    await user.click(disabled);

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

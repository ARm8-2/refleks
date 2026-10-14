// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, translate } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { Modal } from "./Modal";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

type ModalHarnessProps = {
  closeOnOutsideClick?: boolean;
  closeOnEscapeKey?: boolean;
  showCloseButton?: boolean;
  width?: string | number;
  height?: string | number;
};

function ModalHarness({
  closeOnOutsideClick,
  closeOnEscapeKey,
  showCloseButton,
  width,
  height,
}: ModalHarnessProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <I18nProvider>
      <button onClick={() => setIsOpen(true)}>Open details</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Run details"
        closeOnOutsideClick={closeOnOutsideClick}
        closeOnEscapeKey={closeOnEscapeKey}
        showCloseButton={showCloseButton}
        width={width}
        height={height}
      >
        Modal content
      </Modal>
    </I18nProvider>
  );
}

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open details" }));
  return screen.findByRole("dialog", { name: "Run details" });
}

describe("Modal", () => {
  it("opens with its accessible title and closes with Escape by default", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await openModal(user);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can prevent Escape from closing the modal", async () => {
    const user = userEvent.setup();
    render(<ModalHarness closeOnEscapeKey={false} />);

    await openModal(user);
    await user.keyboard("{Escape}");

    expect(
      screen.getByRole("dialog", { name: "Run details" }),
    ).toBeInTheDocument();
  });

  it("closes on outside interaction by default and can disable that behavior", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ModalHarness />);

    const dialog = await openModal(user);
    const overlay = dialog.parentElement?.querySelector<HTMLElement>(
      '[data-state="open"]:not([role="dialog"])',
    );
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay!);
    fireEvent.click(overlay!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<ModalHarness closeOnOutsideClick={false} />);
    const disabledDismissDialog = await openModal(user);
    const disabledDismissOverlay =
      disabledDismissDialog.parentElement?.querySelector<HTMLElement>(
        '[data-state="open"]:not([role="dialog"])',
      );
    expect(disabledDismissOverlay).not.toBeNull();
    fireEvent.pointerDown(disabledDismissOverlay!);
    fireEvent.click(disabledDismissOverlay!);
    expect(
      screen.getByRole("dialog", { name: "Run details" }),
    ).toBeInTheDocument();
  });

  it("supports hiding the close button and converts numeric dimensions to pixels", async () => {
    const user = userEvent.setup();
    render(<ModalHarness showCloseButton={false} width={640} height={480} />);

    const dialog = await openModal(user);
    expect(
      screen.queryByRole("button", {
        name: translate("common.dialog.close"),
      }),
    ).not.toBeInTheDocument();
    expect(dialog).toHaveStyle({ width: "640px", height: "480px" });
  });
});

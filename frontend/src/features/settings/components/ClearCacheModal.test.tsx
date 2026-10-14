// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/shared/lib";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { ClearCacheModal } from "./ClearCacheModal";

vi.mock("@/shared/lib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib")>();
  return { ...actual, clearCache: vi.fn() };
});

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
  vi.mocked(clearCache).mockReset();
  vi.mocked(clearCache).mockResolvedValue(undefined);
});

describe("ClearCacheModal", () => {
  it("clears cached data and closes after success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <ClearCacheModal isOpen onClose={onClose} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Clear Cache" }));

    expect(clearCache).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes without clearing when the user cancels", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <ClearCacheModal isOpen onClose={onClose} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(clearCache).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

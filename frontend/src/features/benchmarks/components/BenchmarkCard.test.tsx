// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Benchmark } from "@/shared/types";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import { BenchmarkCard } from "./BenchmarkCard";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

const benchmark: Benchmark = {
  benchmarkName: "Voltaic Fundamentals",
  rankCalculation: "vt-energy",
  abbreviation: "VT",
  color: "#456789",
  spreadsheetURL: "https://example.com/benchmark",
  difficulties: [],
};

describe("BenchmarkCard", () => {
  it("selects the benchmark when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <I18nProvider>
        <BenchmarkCard
          benchmark={benchmark}
          isFavorite={false}
          onToggleFavorite={vi.fn()}
          onSelect={onSelect}
        />
      </I18nProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: /Voltaic Fundamentals/ }),
    );

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("selects the benchmark when activated by keyboard", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <I18nProvider>
        <BenchmarkCard
          benchmark={benchmark}
          isFavorite={false}
          onToggleFavorite={vi.fn()}
          onSelect={onSelect}
        />
      </I18nProvider>,
    );

    const card = screen.getByRole("button", { name: /Voltaic Fundamentals/ });
    card.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("toggles favorite without selecting the benchmark card", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onToggleFavorite = vi.fn();

    render(
      <I18nProvider>
        <BenchmarkCard
          benchmark={benchmark}
          isFavorite={false}
          onToggleFavorite={onToggleFavorite}
          onSelect={onSelect}
        />
      </I18nProvider>,
    );

    const favoriteButton = screen.getByRole("button", { name: "Favorite" });
    expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
    await user.click(favoriteButton);

    expect(onToggleFavorite).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

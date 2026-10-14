// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";
import { SessionProgressWidget } from "./SessionProgressWidget";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

function makeSnapshot(): RecentSessionSnapshot {
  return {
    currentSession: {
      id: "session-1",
      start: "2026-10-14T10:00:00.000Z",
      end: "2026-10-14T10:30:00.000Z",
      items: [],
    },
    isInSession: true,
    statusTone: "neutral",
    statusLabel: "On pace",
    latestSessionLabel: "Today, 10:30 AM",
    sessionLengthLabel: "30m",
    sessionLengthDetail: "Elapsed so far",
    activePlaytimeLabel: "24m",
    activePlaytimeDetail: "80% active",
    streakLabel: "2 days",
    streakDetail: "24m today",
    topStreak: 3,
    performanceValue: "On pace",
    performanceDetail: "On pace",
    currentRuns: 4,
    suggestedRuns: 8,
    warmupRuns: 2,
    peakStart: 3,
    peakEnd: 6,
    diminishingReturnsAt: 10,
    sessionsAnalyzed: 3,
    lastRunScenario: "Scenario Alpha",
    lastRunScore: 1200,
    lastRunAccuracy: 0.85,
    lastRunScoreTrend: "up",
    lastRunAccTrend: "flat",
    recentScores: [],
    recentScoresScenario: "Scenario Alpha",
    recentScoresSessionBest: 1200,
    recentScoresPb: 1300,
    recentScoresSessionStartIndex: 0,
  };
}

describe("SessionProgressWidget", () => {
  it("persists a custom target entered by the user", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <SessionProgressWidget snapshot={makeSnapshot()} />
      </I18nProvider>,
    );

    await user.click(screen.getByTitle("Edit session target"));
    const targetInput = await screen.findByRole("spinbutton");
    await user.click(targetInput);
    await user.keyboard("{Control>}a{/Control}12");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          STORAGE_KEYS.overviewSessionProgressTargetRuns,
        ),
      ).toBe("12");
    });
    expect(screen.getByTitle("Edit session target")).toHaveTextContent(
      "12target",
    );
  });

  it("restores the automatic target when a custom target is reset", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEYS.overviewSessionProgressTargetRuns,
      "12",
    );

    render(
      <I18nProvider>
        <SessionProgressWidget snapshot={makeSnapshot()} />
      </I18nProvider>,
    );

    await user.click(screen.getByTitle("Edit session target"));
    await user.click(await screen.findByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          STORAGE_KEYS.overviewSessionProgressTargetRuns,
        ),
      ).toBe("null");
    });
    expect(screen.getByTitle("Edit session target")).toHaveTextContent(
      "8target auto",
    );
  });
});

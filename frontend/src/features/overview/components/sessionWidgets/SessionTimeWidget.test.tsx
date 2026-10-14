// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/shared/lib/i18n";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";
import { SessionTimeWidget } from "./SessionTimeWidget";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEYS.language, "en");
});

function makeSnapshot(
  overrides: Partial<RecentSessionSnapshot> = {},
): RecentSessionSnapshot {
  return {
    currentSession: {
      id: "session-1",
      start: "2026-10-14T10:00:00.000Z",
      end: "2026-10-14T10:30:00.000Z",
      items: [],
    },
    isInSession: false,
    statusTone: "neutral",
    statusLabel: "On pace",
    latestSessionLabel: "Today, 10:30 AM",
    sessionLengthLabel: "30m",
    sessionLengthDetail: "Latest session window",
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
    ...overrides,
  };
}

describe("SessionTimeWidget", () => {
  it("shows the empty state when there is no current session", () => {
    render(
      <I18nProvider>
        <SessionTimeWidget snapshot={makeSnapshot({ currentSession: null })} />
      </I18nProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Session & Playtime" }),
    ).toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.getByText("No session loaded")).toBeInTheDocument();
    expect(screen.queryByText("24m")).not.toBeInTheDocument();
  });

  it("shows session duration and active playtime for the latest session", () => {
    render(
      <I18nProvider>
        <SessionTimeWidget snapshot={makeSnapshot()} />
      </I18nProvider>,
    );

    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("Latest session window")).toBeInTheDocument();
    expect(screen.getByText("24m")).toBeInTheDocument();
    expect(screen.getByText("80% active")).toBeInTheDocument();
  });
});

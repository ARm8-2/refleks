import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeI18n } from "@/i18n";
import {
  populatedRunFixture,
  replayFailedFixture,
  replayProcessingFixture,
  unknownMessageFixture,
} from "@/test/fixtures/acceptanceDtos";
import type { HistoryRun } from "../../lib/historyModels";

const mocks = vi.hoisted(() => ({
  getRunReplay: vi.fn(),
  getRunReplayStatus: vi.fn(),
  eventsOn: vi.fn(() => vi.fn()),
}));

vi.mock("@/shared/lib", () => ({
  getRunReplay: mocks.getRunReplay,
  getRunReplayStatus: mocks.getRunReplayStatus,
}));

vi.mock("@wails/runtime", () => ({
  EventsOn: mocks.eventsOn,
}));

import { ReplayTab } from "./ReplayTab";

const historyRunFixture: HistoryRun = {
  id: "fixture-run",
  sessionId: "fixture-session",
  session: {
    id: "fixture-session",
    start: populatedRunFixture.stats.summary.challengeStart,
    end: populatedRunFixture.stats.summary.challengeStart,
    items: [populatedRunFixture],
  },
  item: populatedRunFixture,
  scenarioName: populatedRunFixture.stats.summary.scenario,
  playedAt: Date.parse(populatedRunFixture.stats.summary.datePlayed),
  score: populatedRunFixture.stats.summary.score,
  accuracy: populatedRunFixture.stats.summary.accuracy,
  durationMs: populatedRunFixture.stats.summary.duration * 1000,
  orderInSession: 0,
};

async function settleReplayLookup() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

describe("ReplayTab typed status fixtures", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    mocks.getRunReplay.mockResolvedValue(null);
    mocks.getRunReplayStatus.mockResolvedValue(replayProcessingFixture);
    mocks.eventsOn.mockReturnValue(vi.fn());
    await initializeI18n("en");
  });

  it("renders the processing state from a typed DTO", async () => {
    render(<ReplayTab primaryRun={historyRunFixture} compareRun={null} />);
    await settleReplayLookup();

    expect(screen.getByText("Processing replay...")).toBeInTheDocument();
  });

  it("renders a failed replay state from a typed DTO", async () => {
    mocks.getRunReplayStatus.mockResolvedValue(replayFailedFixture);
    render(<ReplayTab primaryRun={historyRunFixture} compareRun={null} />);
    await settleReplayLookup();

    expect(screen.getByText("Replay processing failed.")).toBeInTheDocument();
  });

  it("falls back to the generic message for an unknown DTO code", async () => {
    mocks.getRunReplayStatus.mockResolvedValue({
      ...replayFailedFixture,
      ...unknownMessageFixture,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ReplayTab primaryRun={historyRunFixture} compareRun={null} />);
    await settleReplayLookup();

    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
  });
});

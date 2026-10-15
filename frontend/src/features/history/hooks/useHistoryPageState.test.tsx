// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/shared/hooks";
import { STORAGE_KEYS } from "@/shared/lib/storageKeys";
import type { RunRecord } from "@/shared/types";
import { useHistoryPageState } from "./useHistoryPageState";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => window.localStorage.clear());

function makeRun(
  id: string,
  scenario: string,
  score: number,
  timestamp: number,
): RunRecord {
  return {
    filePath: id,
    fileName: `${scenario} - ${id}.csv`,
    stats: {
      summary: {
        scenario,
        score,
        accuracy: 0.8,
        duration: 60,
        datePlayed: new Date(timestamp).toISOString(),
      },
    },
  } as unknown as RunRecord;
}

function makeRuns(): RunRecord[] {
  const now = Date.now();
  return [
    makeRun("recent-tile-low", "Tile Frenzy", 120, now - 15 * 60_000),
    makeRun("recent-tile-high", "Tile Frenzy", 200, now - 10 * 60_000),
    makeRun("recent-smooth", "Smoothbot", 300, now - 5 * 60_000),
    makeRun("older-tile", "Tile Frenzy", 180, now - 2 * 24 * 60 * 60_000),
  ];
}

function wrapperWithRuns(runs: RunRecord[]) {
  function SeedRuns({ children }: { children: ReactNode }) {
    const setRuns = useStore((state) => state.setRuns);
    useEffect(() => setRuns(runs), [runs, setRuns]);
    return <>{children}</>;
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StoreProvider>
        <SeedRuns>{children}</SeedRuns>
      </StoreProvider>
    );
  };
}

describe("useHistoryPageState", () => {
  it("filters and sorts runs, then selects and compares runs", async () => {
    const runs = makeRuns();
    const { result } = renderHook(() => useHistoryPageState(), {
      wrapper: wrapperWithRuns(runs),
    });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2);
      expect(result.current.selectedSession).not.toBeNull();
    });

    expect(result.current.selectedSession?.id).toBe(
      result.current.sessions[0].id,
    );
    expect(result.current.filteredSessionRuns).toHaveLength(3);

    act(() => {
      result.current.setRunQuery("tile");
      result.current.setRunSort("score-desc");
    });

    expect(result.current.filteredSessionRuns.map((run) => run.score)).toEqual([
      200,
      120,
    ]);

    act(() => result.current.selectRun("recent-tile-high"));
    act(() => result.current.compareRunWithPrimary("recent-smooth"));

    expect(result.current.primaryRun?.id).toBe("recent-tile-high");
    expect(result.current.compareRun?.id).toBe("recent-smooth");
    expect(result.current.runInspectorOpen).toBe(true);
    await waitFor(() => expect(result.current.sessionListCollapsed).toBe(true));

    act(() => result.current.clearPrimaryRun());
    expect(result.current.primaryRun).toBeNull();
    expect(result.current.compareRun).toBeNull();
  });

  it("replaces a persisted missing session selection with the newest session", async () => {
    const runs = makeRuns();
    window.localStorage.setItem(
      STORAGE_KEYS.historySelectedSessionId,
      JSON.stringify("session-that-no-longer-exists"),
    );

    const { result } = renderHook(() => useHistoryPageState(), {
      wrapper: wrapperWithRuns(runs),
    });

    await waitFor(() => {
      expect(result.current.selectedSession?.id).toBe(
        result.current.sessions[0]?.id,
      );
    });
    expect(
      window.localStorage.getItem(STORAGE_KEYS.historySelectedSessionId),
    ).toBe(JSON.stringify(result.current.sessions[0].id));
  });
});

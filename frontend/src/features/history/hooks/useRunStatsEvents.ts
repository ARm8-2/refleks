import { getRunStatsEvents } from "@/shared/lib/api";
import type { RunStatsEvent } from "@/shared/types/ipc";
import type { HistoryRun } from "../lib/historyModels";
import { createRunResourceCache, useRunResource } from "./useRunResource";

const statsEventsCache = createRunResourceCache<RunStatsEvent[]>();

// Lazily load the CSV-derived stats events for a run from local storage.
export function useRunStatsEvents(
  run: HistoryRun | null,
): RunStatsEvent[] | null {
  return useRunResource(
    run?.item.filePath,
    getRunStatsEvents,
    statsEventsCache,
  );
}

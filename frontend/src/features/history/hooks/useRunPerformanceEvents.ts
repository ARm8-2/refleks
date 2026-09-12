import { getRunPerformanceEvents } from "@/shared/lib/api";
import type { RunPerformanceEvent } from "@/shared/types/ipc";
import type { HistoryRun } from "../lib/historyModels";
import { createRunResourceCache, useRunResource } from "./useRunResource";

const performanceEventsCache = createRunResourceCache<RunPerformanceEvent[]>();

// Lazily load the v2 performance events for a run from local storage.
export function useRunPerformanceEvents(
  run: HistoryRun | null,
): RunPerformanceEvent[] | null {
  return useRunResource(
    run?.item.filePath,
    getRunPerformanceEvents,
    performanceEventsCache,
  );
}

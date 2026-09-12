import { getRunTrace } from "@/shared/lib/api";
import type { MousePoint } from "@/shared/types/ipc";
import { decodeTrace } from "../lib/decodeTrace";
import type { HistoryRun } from "../lib/historyModels";
import { createRunResourceCache, useRunResource } from "./useRunResource";

// Decoded traces are by far the largest per-run payload, so only the run being
// inspected plus its comparison are kept resident.
const traceCache = createRunResourceCache<MousePoint[]>(2);

async function loadTrace(filePath: string): Promise<MousePoint[]> {
  const encoded = await getRunTrace(filePath);
  return encoded ? decodeTrace(encoded) : [];
}

/**
 * Lazily loads mouse trace data for a run from local storage.
 * Like events, traces are fetched from disk on demand instead of being held in
 * bulk run history state.
 */
export function useRunTrace(run: HistoryRun | null): MousePoint[] | null {
  return useRunResource(run?.item.filePath, loadTrace, traceCache);
}

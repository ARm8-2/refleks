import { usePersistedState } from "@/shared/hooks";
import {
  benchmarkDetailDifficultyStorageKey,
  getBenchmarkProgress,
} from "@/shared/lib";
import type { Benchmark, BenchmarkProgress } from "@/shared/types";
import { EventsOn } from "@wails/runtime";
import { useEffect, useMemo, useState } from "react";

const REFRESH_DEBOUNCE_MS = 700;

type State = {
  progress: BenchmarkProgress | null;
  loading: boolean;
  error: string | null;
  difficultyIndex: number;
  setDifficultyIndex: (value: number) => void;
};

type BenchmarkProgressUpdatedEvent = {
  id: number;
  progress: BenchmarkProgress;
};

function isBenchmarkProgressUpdatedEvent(
  data: unknown,
): data is BenchmarkProgressUpdatedEvent {
  if (!data || typeof data !== "object") return false;

  const candidate = data as { id?: unknown; progress?: unknown };
  return typeof candidate.id === "number" && candidate.progress !== undefined;
}

export function useBenchmarkDetailProgress(
  benchmark: Benchmark | undefined,
): State {
  const [difficultyIndex, setDifficultyIndex] = usePersistedState<number>(
    benchmarkDetailDifficultyStorageKey(benchmark?.benchmarkName),
    0,
  );

  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxIndex = Math.max(0, (benchmark?.difficulties?.length ?? 1) - 1);
  const safeIndex = Math.max(0, Math.min(maxIndex, difficultyIndex));

  useEffect(() => {
    if (safeIndex !== difficultyIndex) setDifficultyIndex(safeIndex);
  }, [difficultyIndex, safeIndex, setDifficultyIndex]);

  const selectedDifficulty = useMemo(
    () => benchmark?.difficulties?.[safeIndex],
    [benchmark, safeIndex],
  );

  const benchmarkId = selectedDifficulty?.kovaaksBenchmarkId ?? null;

  useEffect(() => {
    if (!benchmarkId) {
      setProgress(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const refreshProgress = async () => {
      try {
        const nextProgress = await getBenchmarkProgress(benchmarkId);
        if (cancelled) return;
        setProgress(nextProgress);
        setError(null);
      } catch (refreshError) {
        if (cancelled) return;
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
        );
      }
    };

    setLoading(true);
    refreshProgress().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const offRealtime = EventsOn(
      "benchmark:progress:updated",
      (data: unknown) => {
        if (
          cancelled ||
          !isBenchmarkProgressUpdatedEvent(data) ||
          data.id !== benchmarkId
        )
          return;
        setProgress(data.progress);
        setError(null);
      },
    );

    const triggerRefresh = () => {
      if (cancelled) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        void refreshProgress();
      }, REFRESH_DEBOUNCE_MS);
    };

    const offRunsAdded = EventsOn("runs:added", () => triggerRefresh());

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);

      try {
        offRealtime();
      } catch {}
      try {
        offRunsAdded();
      } catch {}
    };
  }, [benchmarkId]);

  return {
    progress,
    loading,
    error,
    difficultyIndex: safeIndex,
    setDifficultyIndex,
  };
}

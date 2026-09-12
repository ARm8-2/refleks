import { useEffect, useState } from "react";

/**
 * Cache for run data that was already read from disk.
 *
 * The inspector remounts its tabs whenever the user switches runs (and unmounts
 * them entirely when it is minimized), so without a cache every revisit dropped
 * back to a loading placeholder even for a run that had just been loaded. Caching
 * the decoded result keeps revisits instant and, importantly, synchronous: the
 * charts mount with their data already present, which lets the reveal animation
 * play instead of a static first paint.
 *
 * The cache is intentionally bounded and LRU-ordered. Only the handful of runs a
 * user is flipping between stay resident, so browsing a long history cannot grow
 * memory without bound.
 */
export const DEFAULT_RUN_CACHE_SIZE = 8;

export type RunResourceCache<T> = {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
};

export function createRunResourceCache<T>(
  maxEntries = DEFAULT_RUN_CACHE_SIZE,
): RunResourceCache<T> {
  const entries = new Map<string, T>();

  return {
    get(key) {
      const hit = entries.get(key);
      if (hit === undefined) return undefined;
      // Refresh recency so the runs being compared stay cached.
      entries.delete(key);
      entries.set(key, hit);
      return hit;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
  };
}

/**
 * Lazily loads a run resource, reusing a cached value when one exists.
 *
 * The result is only exposed once it belongs to the requested file path, so a
 * caller that just switched runs can never pair one run's data with another
 * run's stats during the render before the load effect runs. Consumers that want
 * to keep the previous run on screen while the next one loads should retain the
 * last non-null result themselves (see `useRetainedValue`).
 */
export function useRunResource<T extends unknown[]>(
  filePath: string | null | undefined,
  load: (filePath: string) => Promise<T>,
  cache: RunResourceCache<T>,
): T | null {
  const path = filePath || null;
  const [state, setState] = useState<{ path: string | null; data: T | null }>(
    () => ({ path, data: path ? (cache.get(path) ?? null) : null }),
  );

  useEffect(() => {
    // The functional updates bail out when the state already matches, so
    // mounting with a cached value (the common case) costs no extra render.
    if (!path) {
      setState((prev) =>
        prev.path === null && prev.data === null
          ? prev
          : { path: null, data: null },
      );
      return;
    }

    const cached = cache.get(path);
    if (cached !== undefined) {
      setState((prev) =>
        prev.path === path && prev.data === cached
          ? prev
          : { path, data: cached },
      );
      return;
    }

    let cancelled = false;
    setState((prev) =>
      prev.path === path && prev.data === null ? prev : { path, data: null },
    );

    load(path)
      .then((result) => {
        if (cancelled) return;
        cache.set(path, result);
        setState({ path, data: result });
      })
      .catch(() => {
        if (!cancelled) setState({ path, data: [] as unknown as T });
      });

    return () => {
      cancelled = true;
    };
  }, [path, load, cache]);

  return state.path === path ? state.data : null;
}

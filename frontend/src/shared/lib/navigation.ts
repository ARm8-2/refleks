/**
 * Typed path builders for cross-page navigation.
 *
 * Use these with React Router's `<Link>`, `<NavLink>`, or `useNavigate()` to
 * create deep-links with proper route params.
 */

import { STORAGE_KEYS } from "./storageKeys";

export const LAST_ROUTE_STORAGE_KEY = STORAGE_KEYS.navLastPath;
const RESTORABLE_ROUTE_PREFIXES = [
  "/overview",
  "/history",
  "/benchmarks",
  "/settings",
] as const;

/**
 * Persist History inspector selection so the page opens with a specific run selected.
 * Values are stored as JSON strings to match usePersistedState semantics.
 */
export function primeHistoryRunSelection(
  runId: string,
  sessionId: string,
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.historySelectedSessionId,
      JSON.stringify(sessionId),
    );
    localStorage.setItem(
      STORAGE_KEYS.historyPrimaryRunId,
      JSON.stringify(runId),
    );
    localStorage.setItem(
      STORAGE_KEYS.historyCompareRunId,
      JSON.stringify(null),
    );
    localStorage.setItem(
      STORAGE_KEYS.historyRunInspectorOpen,
      JSON.stringify(true),
    );
  } catch {
    // Ignore storage failures and let History fall back to defaults.
  }
}

function isRestorableRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return RESTORABLE_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/** Persist last visited in-app route for index-route restore. */
export function writeLastRoute(pathname: string): void {
  try {
    localStorage.setItem(LAST_ROUTE_STORAGE_KEY, pathname);
  } catch {
    // Ignore storage failures.
  }
}

/** Read last visited in-app route from localStorage (if valid). */
export function readLastRoute(): string | null {
  try {
    const value = localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    if (!value || !value.startsWith("/")) return null;
    return isRestorableRoute(value) ? value : null;
  } catch {
    return null;
  }
}

/** Build a path to a specific benchmark detail page by name. */
export function benchmarkPath(benchmarkName: string): string {
  return `/benchmarks/${encodeURIComponent(benchmarkName)}`;
}

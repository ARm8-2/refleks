import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
let reducedMotionQuery: MediaQueryList | null = null;

function getReducedMotionQuery(): MediaQueryList | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  reducedMotionQuery ??= window.matchMedia(REDUCED_MOTION_QUERY);
  return reducedMotionQuery;
}

/** True when the operating system asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  return getReducedMotionQuery()?.matches ?? false;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = getReducedMotionQuery();
  if (!query) return () => {};

  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Reactively tracks changes to the system reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    () => false,
  );
}

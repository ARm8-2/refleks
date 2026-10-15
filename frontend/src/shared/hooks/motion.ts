import { useSyncExternalStore } from "react";
import {
  getSavedMotionPreference,
  MOTION_PREFERENCE_CHANGED_EVENT,
  refreshMotionPreferenceFromStorage,
  shouldReduceMotion,
} from "../lib/motion";
import { STORAGE_KEYS } from "../lib/storageKeys";

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

/** Resolves the app's motion setting against the current system preference. */
export function prefersReducedMotion(): boolean {
  return shouldReduceMotion(
    getSavedMotionPreference(),
    getReducedMotionQuery()?.matches ?? false,
  );
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = getReducedMotionQuery();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.motionPreference || event.key === null) {
      refreshMotionPreferenceFromStorage();
      onChange();
    }
  };

  query?.addEventListener("change", onChange);
  if (typeof window !== "undefined") {
    window.addEventListener(MOTION_PREFERENCE_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
  }

  return () => {
    query?.removeEventListener("change", onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener(MOTION_PREFERENCE_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Tracks the effective app/system motion preference reactively. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    () => false,
  );
}

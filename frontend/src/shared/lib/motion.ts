import { STORAGE_KEYS } from "./storageKeys";

export const MOTION_PREFERENCES = ["system", "reduced", "full"] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

export const DEFAULT_MOTION_PREFERENCE: MotionPreference = "system";
export const MOTION_PREFERENCE_CHANGED_EVENT =
  "refleks-motion-preference-changed";

let currentMotionPreference: MotionPreference | null = null;

export function isMotionPreference(value: unknown): value is MotionPreference {
  return (MOTION_PREFERENCES as readonly unknown[]).includes(value);
}

export function getSavedMotionPreference(): MotionPreference {
  if (currentMotionPreference !== null) return currentMotionPreference;

  try {
    const saved = localStorage.getItem(STORAGE_KEYS.motionPreference);
    currentMotionPreference = isMotionPreference(saved)
      ? saved
      : DEFAULT_MOTION_PREFERENCE;
  } catch {
    currentMotionPreference = DEFAULT_MOTION_PREFERENCE;
  }
  return currentMotionPreference;
}

/** Refreshes the cached setting after a change from another app window. */
export function refreshMotionPreferenceFromStorage(): MotionPreference {
  currentMotionPreference = null;
  const preference = getSavedMotionPreference();
  applyMotionPreference(preference);
  return preference;
}

/** Applies a motion preference to the document without persisting it. */
export function applyMotionPreference(preference: MotionPreference) {
  currentMotionPreference = preference;
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motionPreference = preference;
}

/** Persists and applies a motion preference, then notifies subscribed hooks. */
export function setMotionPreference(preference: MotionPreference) {
  try {
    localStorage.setItem(STORAGE_KEYS.motionPreference, preference);
  } catch {
    // Keep the in-memory/document preference usable if storage is unavailable.
  }

  applyMotionPreference(preference);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MOTION_PREFERENCE_CHANGED_EVENT));
  }
}

export function shouldReduceMotion(
  preference: MotionPreference,
  systemPrefersReducedMotion: boolean,
): boolean {
  if (preference === "reduced") return true;
  if (preference === "full") return false;
  return systemPrefersReducedMotion;
}

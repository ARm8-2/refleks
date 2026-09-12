import { useRef } from "react";

/**
 * Returns the newest non-null value, falling back to the most recently seen one.
 *
 * Lazily-loaded panels use this to keep their previous content on screen while
 * the next item loads. Replacing the content with a small loading placeholder
 * and restoring it a moment later collapses and re-expands the layout, which
 * reads as a blink; retaining the last value lets React update the existing tree
 * in place instead.
 *
 * The fallback is only ever a value that was previously returned by the same
 * hook, so callers still decide when to stop rendering it (for example when the
 * selection that produced it is cleared).
 */
export function useRetainedValue<T>(value: T | null): T | null {
  const retained = useRef<T | null>(null);
  if (value !== null) retained.current = value;
  return value ?? retained.current;
}

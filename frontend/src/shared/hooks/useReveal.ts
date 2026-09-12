import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";
import { REVEAL_DELAY_MS } from "./timing";

export type UseRevealOptions = {
  /** Re-arm whenever the component leaves view, replaying the animation. */
  reset?: boolean;
};

/**
 * Returns true once `active` has been true for `delayMs`.
 *
 * The delay lets a component settle after it is focused/scrolled into view
 * before its values animate, so quickly passing it by does not trigger a burst
 * of animation. Once revealed it stays revealed unless `reset` is set.
 */
export function useReveal(
  active: boolean,
  delayMs = REVEAL_DELAY_MS,
  options: UseRevealOptions = {},
): boolean {
  const { reset = false } = options;
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(true);
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!active) {
      if (reset) setRevealed(false);
      return;
    }

    if (revealed && !reset) return;

    if (delayMs <= 0) {
      setRevealed(true);
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setRevealed(true);
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, delayMs, reset, revealed]);

  return revealed;
}

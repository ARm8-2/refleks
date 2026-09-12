import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

type Tick = (now: number) => void;

// All animated numbers share one requestAnimationFrame loop so a screen full of
// counters costs a single frame callback rather than one per value.
const ticks = new Set<Tick>();
let frameId = 0;

function runFrame(now: number) {
  frameId = 0;
  // Copy so a tick that unregisters itself cannot disturb the iteration.
  for (const tick of Array.from(ticks)) tick(now);
  if (ticks.size > 0) frameId = requestAnimationFrame(runFrame);
}

function addTick(tick: Tick) {
  ticks.add(tick);
  if (!frameId) frameId = requestAnimationFrame(runFrame);
}

function removeTick(tick: Tick) {
  ticks.delete(tick);
  if (ticks.size === 0 && frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export type UseAnimatedNumberOptions = {
  /** Tween while true. When false the displayed value is frozen. */
  active?: boolean;
  /** Delay before the first tween after becoming active. */
  delayMs?: number;
  durationMs?: number;
  /** Value rendered before the first animation. Defaults to the target. */
  initial?: number;
};

/**
 * Smoothly animates a number toward `target`.
 *
 * The value is frozen while `active` is false and the first tween after
 * becoming active is delayed by `delayMs`, so updates to offscreen components
 * neither animate nor schedule frames. Only updates that are actually seen
 * produce animation frames, and each frame re-renders only the consumer.
 */
export function useAnimatedNumber(
  target: number,
  options: UseAnimatedNumberOptions = {},
): number {
  const { active = true, delayMs = 0, durationMs = 700, initial } = options;

  const [displayed, setDisplayed] = useState<number>(() =>
    initial !== undefined ? initial : target,
  );
  const displayedRef = useRef(displayed);
  const tickRef = useRef<Tick | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef(false);

  const stop = useCallback(() => {
    if (tickRef.current) {
      removeTick(tickRef.current);
      tickRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const animateTo = useCallback(
    (to: number) => {
      stop();

      const from = displayedRef.current;
      if (from === to) return;

      if (durationMs <= 0 || prefersReducedMotion()) {
        displayedRef.current = to;
        setDisplayed(to);
        return;
      }

      const start = performance.now();
      const tick: Tick = (now) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const value = from + (to - from) * easeOutCubic(progress);
        displayedRef.current = value;
        setDisplayed(value);

        if (progress >= 1) {
          removeTick(tick);
          tickRef.current = null;
          displayedRef.current = to;
          setDisplayed(to);
        }
      };

      tickRef.current = tick;
      addTick(tick);
    },
    [durationMs, stop],
  );

  useEffect(() => {
    if (!active) {
      stop();
      // Re-arm the entrance delay so revealing the component animates again.
      armedRef.current = false;
      return;
    }

    if (!armedRef.current) {
      armedRef.current = true;
      // The delay only applies to the first value after being revealed; later
      // updates while visible animate immediately.
      if (displayedRef.current === target) return;
      if (delayMs > 0) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          animateTo(target);
        }, delayMs);
        return;
      }
    }

    if (displayedRef.current === target) return;
    animateTo(target);
  }, [active, target, delayMs, animateTo, stop]);

  useEffect(() => stop, [stop]);

  return displayed;
}

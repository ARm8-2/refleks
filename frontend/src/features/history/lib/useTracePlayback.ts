import type { MousePoint } from "@/shared/types/ipc";
import { useCallback, useEffect, useRef, useState } from "react";
import { findPointIndex } from "./traceRenderer";

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export type PlaybackState = {
  /** Index into points[] — how far we've replayed. */
  playIndex: number;
  /** Whether animation is running. */
  isPlaying: boolean;
  /** Elapsed ms from t0 in trace time. */
  progressMs: number;
  /** Total trace duration ms. */
  durationMs: number;
};

export type PlaybackActions = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  seekTo: (ms: number) => void;
  nudge: (deltaMs: number) => void;
};

export function useTracePlayback(
  points: MousePoint[],
  speed: number,
  onIndexChange?: (idx: number) => void,
): [PlaybackState, PlaybackActions] {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(points.length);

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const virtualElapsedRef = useRef(0);
  const baseStartRef = useRef(0);
  const curIdxRef = useRef(0);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const t0 = points[0]?.ts ?? 0;
  const tN = points[points.length - 1]?.ts ?? 0;
  const durationMs = Math.max(0, tN - t0);

  const curTs = points[clamp(playIndex, 0, points.length - 1)]?.ts ?? 0;
  const progressMs = Math.max(0, curTs - t0);

  // Reset when points change
  useEffect(() => {
    stopAnim();
    setIsPlaying(false);
    setPlayIndex(points.length);
    curIdxRef.current = 0;
    virtualElapsedRef.current = 0;
    baseStartRef.current = 0;
  }, [points]);

  function stopAnim() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function tick() {
    const now = performance.now();
    const dt = now - lastFrameRef.current;
    lastFrameRef.current = now;
    virtualElapsedRef.current += dt * speedRef.current;

    const targetTs = baseStartRef.current + virtualElapsedRef.current;
    let i = curIdxRef.current;
    while (i < points.length && points[i].ts <= targetTs) i++;
    curIdxRef.current = i;
    setPlayIndex(i);
    onIndexChange?.(i);

    if (targetTs >= tN || i >= points.length) {
      // Loop
      curIdxRef.current = 0;
      setPlayIndex(0);
      baseStartRef.current = points[0]?.ts ?? t0;
      virtualElapsedRef.current = 0;
      lastFrameRef.current = performance.now();
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  const play = useCallback(() => {
    if (isPlaying || points.length < 2) return;
    setIsPlaying(true);
    lastFrameRef.current = performance.now();
    const curIdx = clamp(playIndex, 0, points.length - 1);
    curIdxRef.current = curIdx;
    baseStartRef.current = points[curIdx]?.ts ?? t0;
    virtualElapsedRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [isPlaying, points, playIndex]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    stopAnim();
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seekTo = useCallback(
    (ms: number) => {
      const abs = t0 + clamp(ms, 0, durationMs);
      const i = findPointIndex(points, abs);
      curIdxRef.current = i;
      setPlayIndex(i);
      onIndexChange?.(i);
      if (isPlaying) {
        baseStartRef.current = points[i]?.ts ?? t0;
        virtualElapsedRef.current = 0;
        lastFrameRef.current = performance.now();
      }
    },
    [points, t0, durationMs, isPlaying],
  );

  const nudge = useCallback(
    (deltaMs: number) => {
      seekTo(progressMs + deltaMs);
    },
    [seekTo, progressMs],
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    stopAnim();
    curIdxRef.current = points.length;
    setPlayIndex(points.length);
    onIndexChange?.(points.length);
  }, [points]);

  // Cleanup on unmount
  useEffect(() => () => stopAnim(), []);

  return [
    { playIndex, isPlaying, progressMs, durationMs },
    { play, pause, toggle, reset, seekTo, nudge },
  ];
}

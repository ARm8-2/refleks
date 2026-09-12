import { prefersReducedMotion } from "./motion";
import { REVEAL_DELAY_MS } from "./timing";
import { useInView } from "./useInView";
import { useReveal } from "./useReveal";

export type ChartAnimationProps = {
  isAnimationActive: boolean;
  animationDuration: number;
  animationBegin: number;
  animationEasing: "ease-out";
  /**
   * Keeps the series unmounted until the chart has been revealed. Without this
   * Recharts paints the finished chart for a frame before the entrance
   * animation starts.
   */
  hide: boolean;
};

export type UseChartAnimationResult = {
  /** Attach to the chart container so animation only runs while it is visible. */
  ref: (element: HTMLDivElement | null) => void;
  /** Whether the chart is currently on screen. */
  inView: boolean;
  /**
   * True shortly after the chart becomes visible. Render the series only when
   * this is true: rendering them earlier paints the finished chart for a frame
   * before Recharts starts its entrance animation.
   */
  revealed: boolean;
  /** Spread onto every Recharts series (Line/Bar/Area/Scatter/Radar/Pie). */
  animationProps: ChartAnimationProps;
};

/**
 * Recharts animation settings that only animate while the chart is on screen
 * and never run for users who asked for reduced motion.
 *
 * Call this in the component that renders the chart itself, so the hook mounts
 * and unmounts with it. If an always-mounted host (a widget, or a dialog that
 * stays in the tree) owns the hook while the chart only mounts later, `revealed`
 * stays true and the entrance animation is skipped on every reopen after the
 * first. Extract the chart into its own component instead of hoisting the hook.
 */
export function useChartAnimation(options?: {
  durationMs?: number;
  delayMs?: number;
  /** Set false to disable animation entirely (e.g. very large data sets). */
  enabled?: boolean;
}): UseChartAnimationResult {
  const {
    durationMs = 700,
    delayMs = REVEAL_DELAY_MS,
    enabled = true,
  } = options ?? {};
  const { ref, inView } = useInView<HTMLDivElement>();
  const revealed = useReveal(inView, delayMs);

  return {
    ref,
    inView,
    revealed,
    animationProps: {
      isAnimationActive: enabled && revealed && !prefersReducedMotion(),
      animationDuration: durationMs,
      animationBegin: 0,
      animationEasing: "ease-out",
      hide: !revealed,
    },
  };
}

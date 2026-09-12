/**
 * Cached media query so repeated checks (every chart render and every number
 * tween) do not build a new MediaQueryList each time. The list is live, so it
 * still reflects changes to the operating system setting.
 */
let reducedMotionQuery: MediaQueryList | null = null;

/**
 * True when the operating system asks for reduced motion. Callers should snap
 * to the final value instead of animating.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery.matches;
}

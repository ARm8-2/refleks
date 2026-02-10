/**
 * Typed path builders for cross-page navigation.
 *
 * Use these with React Router's `<Link>`, `<NavLink>`, or `useNavigate()` to
 * create deep-links with proper route params.
 */

/** Build a path to a specific benchmark detail page by name. */
export function benchmarkPath(benchmarkName: string): string {
  return `/benchmarks/${encodeURIComponent(benchmarkName)}`
}

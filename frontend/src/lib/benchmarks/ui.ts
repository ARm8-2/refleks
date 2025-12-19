// Determine the fill color used for a scenario subbar based on the last achieved
// rank and a fallback. Returns a CSS color string (hex or similar).
export function computeFillColor(achievedRank: number | undefined | null, rankDefs: Array<{ color?: string }>, fallback = 'var(--chart-neutral)'): string {
  const ach = Number(achievedRank || 0)
  if (!ach || ach <= 0) return fallback
  const lastIdx = Math.max(0, Math.min((rankDefs?.length ?? 0) - 1, ach - 1))
  const lastColor = rankDefs?.[lastIdx]?.color
  // Return the raw color value (usually a hex string) so the UI shows the
  // true, non-dimmed color. If the color isn't present, fall back to gray.
  return lastColor ?? fallback
}

import { ENERGY_COL_WIDTH, PLAY_COL_WIDTH, RANK_MIN_WIDTH, RECOMMEND_COL_WIDTH, SCORE_COL_WIDTH } from './layout'

export function benchmarkGridTemplate(scenarioWidth: number, rankCount: number, hasOverflow: boolean): string {
  const rankSpec = hasOverflow ? `${RANK_MIN_WIDTH}px` : `minmax(${RANK_MIN_WIDTH}px,1fr)`
  const ranks = Array.from({ length: rankCount }).map(() => rankSpec).join(' ')
  return `${Math.round(scenarioWidth)}px ${RECOMMEND_COL_WIDTH}px ${PLAY_COL_WIDTH}px ${SCORE_COL_WIDTH}px ${ranks} ${ENERGY_COL_WIDTH}px`
}

// Compute fill fraction for rank cell index of a scenario
export function cellFill(index: number, score: number, thresholds: number[]): number {
  const m = thresholds?.length ?? 0
  if (m < 2) return 0
  // thresholds includes baseline at [0], then rank thresholds starting at [1]
  const prev = thresholds[index] ?? 0
  const next = thresholds[index + 1] ?? prev

  if (next <= prev) {
    // Degenerate interval: treat as filled if score >= next
    return Number(score ?? 0) >= next ? 1 : 0
  }

  const frac = (Number(score ?? 0) - prev) / (next - prev)
  return Math.max(0, Math.min(1, frac))
}

// Overall normalized progress across ranks [0..1]
// Uses achieved rank and proximity to next threshold when available.
export function normalizedRankProgress(scenarioRank: number, score: number, thresholds: number[]): number {
  const m = thresholds?.length ?? 0
  const n = m > 0 ? m - 1 : 0
  if (n <= 0) return 0
  const r = Math.max(0, Math.min(n, Number(scenarioRank || 0)))
  if (r <= 0) {
    const prev = thresholds[0] ?? 0
    const next = thresholds[1] ?? prev
    const denom = next - prev
    if (denom <= 0) return 0
    const frac = Math.max(0, Math.min(1, (Number(score || 0) - prev) / denom))
    return frac * (1 / n)
  }
  if (r >= n) return 1
  const prev = thresholds[r] ?? 0
  const next = thresholds[r + 1] ?? prev
  if (next <= prev) return r / n
  const frac = Math.max(0, Math.min(1, (Number(score || 0) - prev) / (next - prev)))
  return (r - 1) / n + frac * (1 / n)
}

// Grid columns for shareable image (no Recom/Play):
// Scenario | Score | Rank1..N
export const gridColsShare = (count: number) => `minmax(260px,1fr) 110px ${Array.from({ length: count }).map(() => '130px').join(' ')}`

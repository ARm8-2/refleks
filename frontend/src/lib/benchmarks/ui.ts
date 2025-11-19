export function hexToRgba(hex: string, alpha = 0.18): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return `rgba(255,255,255,${alpha})`
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Determine the fill color used for a scenario subbar based on the last achieved
// rank and a fallback (simple gray). Returns a CSS rgba string at the requested alpha.
export function computeFillColor(achievedRank: number | undefined | null, rankDefs: Array<{ color?: string }>, alpha = 0.35, fallback = '#9a9a9a'): string {
  const ach = Number(achievedRank || 0)
  if (!ach || ach <= 0) return hexToRgba(fallback, alpha)
  const lastIdx = Math.max(0, Math.min((rankDefs?.length ?? 0) - 1, ach - 1))
  const lastColor = rankDefs?.[lastIdx]?.color
  return lastColor ? hexToRgba(lastColor, alpha) : hexToRgba(fallback, alpha)
}

// Contribution from threshold proximity + rank deficiency for recommendations.
export function thresholdContribution(achieved: number, score: number, thresholds: number[], rankCount: number): number {
  if (!Array.isArray(thresholds) || thresholds.length < 2 || rankCount <= 0) return 0
  const idx = Math.max(0, Math.min(rankCount, achieved))
  const prev = thresholds[idx] ?? 0
  const next = thresholds[idx + 1] ?? null
  let pts = 0
  if (next != null && next > prev) {
    const frac = Math.max(0, Math.min(1, (score - prev) / (next - prev)))
    pts += 40 * frac
  }
  const achievedNorm = Math.max(0, Math.min(1, achieved / Math.max(1, rankCount)))
  pts += 20 * (1 - achievedNorm)
  return pts
}

// Dynamic grid template for BenchmarkProgress (Scenario | Recom | Play | Score | Rank1..N)
// If there is no horizontal overflow, let rank columns flex with minmax.
import { PLAY_COL_WIDTH, RANK_MIN_WIDTH, RECOMMEND_COL_WIDTH, SCENARIO_DEFAULT_WIDTH, SCORE_COL_WIDTH } from './layout'

export function benchmarkGridTemplate(scenarioWidth: number, rankCount: number, hasOverflow: boolean): string {
  const rankSpec = hasOverflow ? `${RANK_MIN_WIDTH}px` : `minmax(${RANK_MIN_WIDTH}px,1fr)`
  const ranks = Array.from({ length: rankCount }).map(() => rankSpec).join(' ')
  return `${Math.round(scenarioWidth)}px ${RECOMMEND_COL_WIDTH}px ${PLAY_COL_WIDTH}px ${SCORE_COL_WIDTH}px ${ranks}`
}

import { MISSING_STR } from '../utils'

export function numberFmt(n: number | null | undefined): string {
  if (n == null || isNaN(+n)) return MISSING_STR
  try {
    return new Intl.NumberFormat().format(+n)
  } catch {
    return String(n)
  }
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

// Grid columns for BenchmarkProgress rows:
// Scenario | Recom | Play | Score | Rank1..N
// Deprecated static grid cols (prefer benchmarkGridTemplate + constants)
export const gridCols = (count: number) => `minmax(${SCENARIO_DEFAULT_WIDTH}px,1fr) ${RECOMMEND_COL_WIDTH}px ${PLAY_COL_WIDTH}px ${SCORE_COL_WIDTH}px ${Array.from({ length: count }).map(() => `${RANK_MIN_WIDTH}px`).join(' ')}`

// Grid columns for shareable image (no Recom/Play):
// Scenario | Score | Rank1..N
export const gridColsShare = (count: number) => `minmax(260px,1fr) 110px ${Array.from({ length: count }).map(() => '130px').join(' ')}`

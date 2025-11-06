export function hexToRgba(hex: string, alpha = 0.18): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return `rgba(255,255,255,${alpha})`
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function numberFmt(n: number | null | undefined): string {
  if (n == null || isNaN(+n)) return '—'
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
export const gridCols = (count: number) => `minmax(220px,1fr) 80px 40px 90px ${Array.from({ length: count }).map(() => '120px').join(' ')}`

// Grid columns for shareable image (no Recom/Play):
// Scenario | Score | Rank1..N
export const gridColsShare = (count: number) => `minmax(260px,1fr) 110px ${Array.from({ length: count }).map(() => '130px').join(' ')}`

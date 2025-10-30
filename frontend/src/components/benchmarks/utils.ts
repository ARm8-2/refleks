import type { Benchmark } from '../../types/ipc';

export function buildRankDefs(
  difficulty: Benchmark['difficulties'][number] | undefined,
  progress: Record<string, any> | undefined
): Array<{ name: string; color: string }> {
  if (!difficulty) return []
  const dc: Record<string, string> = (difficulty as any)?.rankColors || {}
  const ranks: Array<any> = Array.isArray((progress as any)?.ranks) ? (progress as any).ranks : []
  if (ranks.length > 0) {
    // Prefer server-provided rank order, map colors from difficulty.rankColors when available
    return ranks
      .filter(r => String(r?.name ?? '').toLowerCase() !== 'no rank')
      .map(r => ({
        name: String(r?.name ?? ''),
        color: dc[String(r?.name ?? '')] || String(r?.color ?? '#ffffff')
      }))
  }
  // Fallback: if server didn't provide ranks, derive from difficulty.rankColors (order may be implementation-defined)
  const dcEntries = Object.entries(dc)
  if (dcEntries.length > 0) {
    return dcEntries.map(([name, color]) => ({ name, color }))
  }
  return []
}

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
  const n = thresholds?.length ?? 0
  if (n === 0) return 0

  const prev = index === 0 ? 0 : (thresholds[index - 1] ?? 0)
  const next = thresholds[index] ?? prev

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
  const n = thresholds?.length ?? 0
  if (n === 0) return 0
  const r = Math.max(0, Math.min(n, Number(scenarioRank || 0)))
  if (r <= 0) {
    const t0 = thresholds[0] ?? 0
    if (t0 <= 0) return 0
    const frac = Math.max(0, Math.min(1, Number(score || 0) / t0))
    return frac * (1 / n)
  }
  if (r >= n) return 1
  const prev = thresholds[r - 1] ?? 0
  const next = thresholds[r] ?? prev
  if (next <= prev) return r / n
  const frac = Math.max(0, Math.min(1, (Number(score || 0) - prev) / (next - prev)))
  return (r - 1) / n + frac * (1 / n)
}

// Grid columns for BenchmarkProgress rows:
// Scenario | Recom | Play | Score | Rank1..N
export const gridCols = (count: number) => `minmax(220px,1fr) 80px 40px 90px ${Array.from({ length: count }).map(() => '120px').join(' ')}`

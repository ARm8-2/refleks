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

// Build metadata from a difficulty definition: categories -> subDefs
export function buildMetaDefs(
  difficulty: Benchmark['difficulties'][number] | undefined
): Array<{
  catName: string
  catColor?: string
  subDefs: Array<{ name: string; count: number; color?: string }>
}> {
  const defs: Array<{
    catName: string
    catColor?: string
    subDefs: Array<{ name: string; count: number; color?: string }>
  }> = []
  if (!difficulty) return defs
  for (const c of (difficulty as any)?.categories || []) {
    const catName = String((c as any)?.categoryName ?? '')
    const catColor = (c as any)?.color as string | undefined
    const subs = Array.isArray((c as any)?.subcategories) ? (c as any).subcategories : []
    const subDefs = subs.map((s: any) => ({
      name: String(s?.subcategoryName ?? ''),
      count: Number(s?.scenarioCount ?? 0),
      color: s?.color as string | undefined,
    }))
    defs.push({ catName, catColor, subDefs })
  }
  return defs
}

// Normalize API progress into ordered categories/groups mapping using metaDefs
export function normalizeProgress(
  progress: Record<string, any> | undefined,
  metaDefs: ReturnType<typeof buildMetaDefs>
): Array<{
  catName: string
  catColor?: string
  groups: Array<{ name: string; color?: string; scenarios: [string, any][] }>
}> {
  type ScenarioEntry = [string, any]
  const categories = progress?.categories as Record<string, any> | undefined
  const result: Array<{
    catName: string
    catColor?: string
    groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }>
  }> = []

  const flat: ScenarioEntry[] = []
  if (categories) {
    for (const cat of Object.values(categories)) {
      const scenEntries = Object.entries((cat as any)?.scenarios || {}) as ScenarioEntry[]
      flat.push(...scenEntries)
    }
  }

  let pos = 0
  for (let i = 0; i < metaDefs.length; i++) {
    const { catName, catColor, subDefs } = metaDefs[i]
    const groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }> = []

    if (subDefs.length > 0) {
      for (const sd of subDefs) {
        const take = Math.max(0, Math.min(sd.count, flat.length - pos))
        const scenarios = take > 0 ? flat.slice(pos, pos + take) : []
        pos += take
        groups.push({ name: sd.name, color: sd.color, scenarios })
      }
    } else {
      groups.push({ name: '', color: undefined, scenarios: [] })
    }

    if (i === metaDefs.length - 1 && pos < flat.length) {
      groups.push({ name: '', color: undefined, scenarios: flat.slice(pos) })
      pos = flat.length
    }

    result.push({ catName, catColor, groups })
  }

  return result
}

// Compute scope scenarios depending on level selection
export function computeScopeScenarios(
  normalized: ReturnType<typeof normalizeProgress>,
  level: 'all' | 'category' | 'subcategory',
  catIdx: number,
  subIdx: number
): [string, any][] {
  if (level === 'all') {
    return normalized.flatMap(c => c.groups.flatMap(g => g.scenarios))
  }
  const c = normalized[Math.min(Math.max(0, catIdx), Math.max(0, normalized.length - 1))]
  if (!c) return []
  if (level === 'category') return c.groups.flatMap(g => g.scenarios)
  const g = c.groups[Math.min(Math.max(0, subIdx), Math.max(0, c.groups.length - 1))]
  return g ? g.scenarios : []
}

// Compute rank counts array and below count for a given scope
export function computeRankCounts(scopeScenarios: [string, any][], rankDefs: Array<{ name: string; color: string }>) {
  const n = rankDefs.length
  const arr = Array.from({ length: n }, () => 0)
  let below = 0
  for (const [_, s] of scopeScenarios) {
    const r = Number(s?.scenario_rank || 0)
    if (r <= 0) below++
    else arr[Math.min(n, r) - 1]++
  }
  return { byRank: arr, below }
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

// For the initial rank interval (below the first threshold) compute a reasonable
// lower bound instead of using 0. We take the average difference between
// successive thresholds and subtract it from the first threshold, clamped to 0.
export function initialThresholdBaseline(thresholds: number[]): number {
  const n = thresholds?.length ?? 0
  if (n <= 1) return 0
  const diffs: number[] = []
  for (let i = 1; i < thresholds.length; i++) {
    const a = Number(thresholds[i] ?? 0)
    const b = Number(thresholds[i - 1] ?? 0)
    const d = a - b
    if (isFinite(d) && d > 0) diffs.push(d)
  }
  if (diffs.length === 0) return 0
  const avg = diffs.reduce((s, x) => s + x, 0) / diffs.length
  const prev = (thresholds[0] ?? 0) - avg
  return prev > 0 ? prev : 0
}

// Compute fill fraction for rank cell index of a scenario
export function cellFill(index: number, score: number, thresholds: number[]): number {
  const n = thresholds?.length ?? 0
  if (n === 0) return 0
  const prev = index === 0 ? initialThresholdBaseline(thresholds) : (thresholds[index - 1] ?? 0)
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
    const prev = initialThresholdBaseline(thresholds)
    const denom = t0 - prev
    if (denom <= 0) return 0
    const frac = Math.max(0, Math.min(1, (Number(score || 0) - prev) / denom))
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

// Grid columns for shareable image (no Recom/Play):
// Scenario | Score | Rank1..N
export const gridColsShare = (count: number) => `minmax(260px,1fr) 110px ${Array.from({ length: count }).map(() => '130px').join(' ')}`

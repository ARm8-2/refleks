import type { ScenarioRecord } from '../types/ipc';
import { BENCHMARK_CATEGORY_ABBREVIATIONS, DEFAULT_BENCHMARK_CATEGORY, MISSING_STR } from './constants';

export function getBenchmarkCategory(abbreviation: string): string {
  const abbr = (abbreviation ?? '').toString().trim()
  let category = DEFAULT_BENCHMARK_CATEGORY
  if (abbr) {
    for (const [cat, aliases] of Object.entries(BENCHMARK_CATEGORY_ABBREVIATIONS)) {
      if (aliases.some(a => a === abbr)) {
        category = cat
        break
      }
    }
  }
  return category
}

export function getScenarioName(it: ScenarioRecord | { fileName?: string; stats?: Record<string, any> }): string {
  const stats = (it as any).stats as Record<string, any> | undefined
  const direct = stats?.['Scenario']
  if (typeof direct === 'string' && direct.trim().length > 0) return direct
  const fn = (it as any).fileName as string | undefined
  if (typeof fn === 'string' && fn.includes(' - ')) return fn.split(' - ')[0]
  return String(direct ?? fn ?? '')
}

// Safe accessor for the "Date Played" field, accepting both spaced and unspaced variants
export function getDatePlayed(stats: Record<string, any> | undefined): string {
  if (!stats) return ''
  return String(stats['Date Played'] ?? stats['DatePlayed'] ?? '')
}

// Human-friendly duration like "1h 2m 3s" for session totals
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!h && (s || parts.length === 0)) parts.push(`${s}s`)
  return parts.join(' ')
}

// Short relative time like "1 hr ago", "2 d ago", or "now".
export function formatRelativeAgoShort(input: string | number | Date | undefined, maxMonths = 12): string {
  if (input == null) return ''
  let ts: number
  if (typeof input === 'number') ts = input
  else if (input instanceof Date) ts = input.getTime()
  else {
    ts = Number.isFinite(Number(input)) ? Number(input) : Date.parse(String(input))
  }
  if (!Number.isFinite(ts)) return String(input)

  const now = Date.now()
  const diff = now - ts
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'now'
  const minutes = Math.floor(sec / 60)
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? '1 d ago' : `${days} d ago`
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7))
    return weeks === 1 ? '1 wk ago' : `${weeks} wk ago`
  }
  const months = Math.max(1, Math.floor(days / 30))
  const m = Math.min(months, Math.max(1, Math.floor(maxMonths)))
  return m === 1 ? '1 mo ago' : `${m} mo ago`
}

export function formatPct01(v: any): string {
  return formatPct(v, 1)
}

// Generic numeric formatter used across the UI. Trims trailing zeros for
// readability (e.g., 1.00 -> 1, 1.50 -> 1.5).
export function formatNumber(v: any, decimals = 2, trimTrailingZeros = true): string {
  if (v == null || v === '') return MISSING_STR
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return MISSING_STR

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: trimTrailingZeros ? 0 : decimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  }).format(n)
}

// Format a value that may be either a fraction (0..1) or an already-multiplied
// percentage (0..100). Produces a single-decimal percentage string like "83.4%",
// avoiding floating-point artifacts like 83.40000000000001%.
export function formatPct(v: any, decimals = 1): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return MISSING_STR
  // Detect fraction vs percentage: treat numbers in range [-1, 1] as fractions
  const value = Math.abs(n) <= 1 ? n * 100 : n
  // For percentages keep the specified decimal places even when they are zeros
  return `${formatNumber(value, decimals, false)}%`
}

export function formatSeconds(v: any, decimals = 2): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return MISSING_STR
  return n.toFixed(decimals) + 's'
}

export function getHighScores(scenarios: ScenarioRecord[]): Map<string, number> {
  const best = new Map<string, number>()
  for (const s of scenarios) {
    const name = getScenarioName(s)
    const score = Number(s.stats['Score'] ?? 0)
    if (!best.has(name) || best.get(name)! < score) {
      best.set(name, score)
    }
  }
  return best
}

export function getBestRuns(scenarios: ScenarioRecord[]): ScenarioRecord[] {
  const best = new Map<string, ScenarioRecord>()
  for (const s of scenarios) {
    const name = getScenarioName(s)
    const score = Number(s.stats['Score'] ?? 0)
    if (!best.has(name) || Number(best.get(name)!.stats['Score'] ?? 0) < score) {
      best.set(name, s)
    }
  }
  return Array.from(best.values())
}

// Helper for formatting tooltip values based on a label hint. This centralizes
// the logic and keeps chart code simpler.
export function formatUiValueForLabel(value: any, label?: string, decimals?: number): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!isFinite(n)) return MISSING_STR
  const l = String(label ?? '')
  if (l.includes('Accuracy') || l.includes('Acc')) return formatPct(n, decimals ?? 1)
  if (l.includes('TTK')) return formatSeconds(n, decimals ?? 2)
  if (l.includes('Score')) return formatNumber(n, decimals ?? 0)
  return formatNumber(n, decimals ?? 2)
}

// Extract a numeric value from Chart.js tooltip/context objects in a safe way.
// The `ctx` param is the item provided to tooltip callbacks; this helper
// understands the typical `parsed` and `raw` forms produced by Chart.js,
// and returns undefined when the value is not a finite number.
export function extractChartValue(ctx: any): number | undefined {
  if (!ctx) return undefined
  let val: any = undefined
  if (ctx.parsed != null) {
    val = (typeof ctx.parsed === 'object' && ctx.parsed !== null) ? (ctx.parsed.y ?? ctx.parsed) : ctx.parsed
  }
  if ((val == null || val === '') && ctx.raw != null) {
    val = (typeof ctx.raw === 'object' && ctx.raw !== null) ? (ctx.raw.y ?? ctx.raw) : ctx.raw
  }
  if (val == null) return undefined
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : undefined
}

// Format seconds for mm:ss with optional fractional seconds (e.g., 3.45 -> "0:03.45")
export function formatMmSs(totalSeconds: any, decimals = 0): string {
  const n = typeof totalSeconds === 'number' ? totalSeconds : Number(totalSeconds)
  if (!isFinite(n)) return MISSING_STR
  const total = Math.max(0, n)
  const m = Math.floor(total / 60)
  const s = total - m * 60
  const sStr = s.toFixed(decimals)
  // pad integer part of seconds to 2 chars
  const [intPart, frac] = sStr.split('.')
  const intPadded = intPart.padStart(2, '0')
  return frac ? `${m}:${intPadded}.${frac}` : `${m}:${intPadded}`
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

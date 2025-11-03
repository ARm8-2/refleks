import type { Session } from '../../types/domain'
import type { ScenarioRecord } from '../../types/ipc'
import { getScenarioName } from '../utils'

export type Metric = 'score' | 'acc'

export function metricOf(rec: ScenarioRecord, metric: Metric): number {
  if (metric === 'score') {
    const v = Number(rec.stats['Score'] ?? 0)
    return Number.isFinite(v) ? v : 0
  } else {
    const a01 = Number(rec.stats['Accuracy'] ?? 0)
    return Number.isFinite(a01) ? a01 * 100 : 0
  }
}

export function runDurationMs(rec: ScenarioRecord): number {
  const datePlayedStr = String(rec.stats['Date Played'] ?? '')
  const end = Date.parse(datePlayedStr)
  const startTime = String(rec.stats['Challenge Start'] ?? '')
  const datePart = datePlayedStr.split('T')[0]
  // Preserve the timezone suffix from Date Played when building the start ISO.
  const tzMatch = datePlayedStr.match(/([+-]\d{2}:\d{2}|Z)$/)
  const tz = tzMatch ? tzMatch[0] : 'Z'
  const startIso = `${datePart}T${startTime}${tz}`
  const start = Date.parse(startIso)
  const d = end - start
  return Number.isFinite(d) ? Math.max(0, d) : 0
}

/** Returns an array of sessions; each contains ordered runs for the scenario (oldest -> newest). */
export function collectRunsBySession(sessions: Session[], scenarioName: string): ScenarioRecord[][] {
  const res: ScenarioRecord[][] = []
  for (const sess of sessions) {
    const items = sess.items.filter(it => getScenarioName(it) === scenarioName)
    if (items.length === 0) continue
    // Order oldest -> newest by end time
    const ordered = [...items].sort((a, b) => Date.parse(String(a.stats['Date Played'])) - Date.parse(String(b.stats['Date Played'])))
    res.push(ordered)
  }
  return res
}

export function expectedByIndex(runs: ScenarioRecord[][], metric: Metric): { mean: number[]; std: number[] } {
  const maxLen = runs.reduce((m, r) => Math.max(m, r.length), 0)
  const mean: number[] = []
  const std: number[] = []
  for (let j = 0; j < maxLen; j++) {
    const vals: number[] = []
    for (const sessRuns of runs) {
      if (j < sessRuns.length) vals.push(metricOf(sessRuns[j], metric))
    }
    const m = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    const variance = vals.length ? vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length : 0
    mean.push(m)
    std.push(Math.sqrt(variance))
  }
  return { mean, std }
}

export function expectedBestVsLength(runs: ScenarioRecord[][], metric: Metric): number[] {
  const maxLen = runs.reduce((m, r) => Math.max(m, r.length), 0)
  const curve: number[] = []
  for (let L = 1; L <= maxLen; L++) {
    const bests: number[] = []
    for (const sessRuns of runs) {
      const vals = sessRuns.slice(0, Math.min(L, sessRuns.length)).map(r => metricOf(r, metric))
      if (vals.length) bests.push(Math.max(...vals))
    }
    const m = bests.length ? bests.reduce((a, b) => a + b, 0) / bests.length : 0
    curve.push(m)
  }
  return curve
}

export type LengthStats = {
  mean: number[]
  min: number[]
  max: number[]
  std: number[]
  p10: number[]
  p90: number[]
  count: number[]
}

/**
 * For each possible session length L, compute the distribution of per-session
 * prefix averages over the first L runs. This answers: "If I play L runs,
 * what is the typical average performance, and how wide is the spread?"
 */
export function expectedAvgVsLength(runs: ScenarioRecord[][], metric: Metric): LengthStats {
  const maxLen = runs.reduce((m, r) => Math.max(m, r.length), 0)
  const mean: number[] = []
  const min: number[] = []
  const max: number[] = []
  const std: number[] = []
  const p10: number[] = []
  const p90: number[] = []
  const count: number[] = []

  for (let L = 1; L <= maxLen; L++) {
    const avgs: number[] = []
    for (const sessRuns of runs) {
      if (sessRuns.length >= L) {
        const vals = sessRuns.slice(0, L).map(r => metricOf(r, metric))
        if (vals.length) {
          const m = vals.reduce((a, b) => a + b, 0) / vals.length
          if (Number.isFinite(m)) avgs.push(m)
        }
      }
    }

    const n = avgs.length
    count.push(n)
    if (n === 0) {
      mean.push(0)
      min.push(0)
      max.push(0)
      std.push(0)
      p10.push(0)
      p90.push(0)
      continue
    }

    const m = avgs.reduce((a, b) => a + b, 0) / n
    const variance = avgs.reduce((a, b) => a + (b - m) * (b - m), 0) / n
    mean.push(m)
    min.push(Math.min(...avgs))
    max.push(Math.max(...avgs))
    std.push(Math.sqrt(Math.max(0, variance)))
    p10.push(percentile(avgs, 10))
    p90.push(percentile(avgs, 90))
  }

  return { mean, min, max, std, p10, p90, count }
}

export type LengthRecommendations = {
  warmupRuns: number
  optimalAvgRuns: number
  optimalConsistentRuns: number
  optimalHighscoreRuns: number
}

export function recommendLengths(
  byIndex: { mean: number[]; std: number[] },
  bestVsL: number[],
  lengthStats?: LengthStats,
): LengthRecommendations {
  const { mean, std } = byIndex
  const n = mean.length
  // Warm-up: first index where slope becomes small and std drops near median
  const slopes: number[] = []
  for (let i = 1; i < n; i++) slopes.push(mean[i] - mean[i - 1])
  const absSlopes = slopes.map(Math.abs)
  const slopeMed = median(absSlopes)
  const stdMed = median(std)
  let warm = 1
  for (let i = 1; i < n; i++) {
    const s = Math.abs(slopes[i - 1] ?? 0)
    if (s <= slopeMed && (std[i] ?? stdMed) <= stdMed) {
      warm = i + 1
      break
    }
  }

  // Optimal average:
  // If per-length stats available, use their mean curve; otherwise fall back to cumulative mean of by-index expectations.
  let avgL = 1
  if (lengthStats && lengthStats.mean.length) {
    let bestVal = -Infinity
    let bestIdx = 0
    for (let i = 0; i < lengthStats.mean.length; i++) {
      const v = lengthStats.mean[i] ?? 0
      if (v > bestVal) { bestVal = v; bestIdx = i }
    }
    const eps = 0.01 * (Math.abs(bestVal) || 1)
    for (let L = 1; L <= lengthStats.mean.length; L++) {
      const v = lengthStats.mean[L - 1] ?? -Infinity
      if ((bestVal - v) <= eps) { avgL = L; break }
    }
  } else {
    let bestL = 1
    let bestVal = -Infinity
    const cum: number[] = []
    let sum = 0
    for (let L = 1; L <= n; L++) {
      sum += mean[L - 1] || 0
      const v = sum / L
      cum.push(v)
      if (v > bestVal) { bestVal = v; bestL = L }
    }
    const eps = 0.01 * (bestVal || 1)
    avgL = bestL
    for (let L = 1; L <= n; L++) {
      if (bestVal - cum[L - 1] <= eps) { avgL = L; break }
    }
  }

  // Consistency: prefer smallest L where recent variability is below typical.
  // Use per-length interdecile range if available; else fall back to by-index std.
  let consL = n
  if (lengthStats && lengthStats.mean.length) {
    const variability = lengthStats.mean.map((_, i) => {
      const lo = lengthStats.p10[i] ?? 0
      const hi = lengthStats.p90[i] ?? 0
      return Math.max(0, hi - lo)
    })
    const varMed = median(variability)
    for (let L = 2; L <= variability.length; L++) {
      const k = Math.min(3, L)
      const window = variability.slice(L - k, L)
      const wMean = window.length ? window.reduce((a, b) => a + b, 0) / window.length : Infinity
      if (wMean <= varMed) { consL = L; break }
    }
  } else {
    for (let L = 2; L <= n; L++) {
      const k = Math.min(3, L)
      const window = std.slice(L - k, L)
      const wMean = window.length ? window.reduce((a, b) => a + b, 0) / window.length : Infinity
      if (wMean <= stdMed) { consL = L; break }
    }
  }

  // Highscore: expected best-of-L curve; choose smallest L within 1% of max and where marginal gain < 2%
  let hsBest = -Infinity
  let hsBestL = 1
  for (let L = 1; L <= bestVsL.length; L++) {
    const v = bestVsL[L - 1] || 0
    if (v > hsBest) { hsBest = v; hsBestL = L }
  }
  let hsL = hsBestL
  const hsEps = 0.01 * (hsBest || 1)
  for (let L = 1; L <= bestVsL.length; L++) {
    const v = bestVsL[L - 1] || 0
    const next = bestVsL[L] ?? v
    const marginal = hsBest ? (next - v) / hsBest : 0
    if ((hsBest - v) <= hsEps && marginal < 0.02) { hsL = L; break }
  }

  return { warmupRuns: warm, optimalAvgRuns: avgL, optimalConsistentRuns: consL, optimalHighscoreRuns: hsL }
}

function median(arr: number[]): number {
  const v = arr.filter(n => Number.isFinite(n)).slice().sort((a, b) => a - b)
  const n = v.length
  if (!n) return 0
  const mid = Math.floor(n / 2)
  return n % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

function percentile(arr: number[], p: number): number {
  const v = arr.filter(n => Number.isFinite(n)).slice().sort((a, b) => a - b)
  const n = v.length
  if (!n) return 0
  const clamped = Math.min(100, Math.max(0, p))
  const rank = Math.ceil((clamped / 100) * n) - 1
  const idx = Math.min(n - 1, Math.max(0, rank))
  return v[idx]
}

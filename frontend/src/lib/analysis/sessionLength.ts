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
  const end = Date.parse(String(rec.stats['Date Played'] ?? ''))
  const startTime = String(rec.stats['Challenge Start'] ?? '')
  const datePart = String(rec.stats['Date Played'] ?? '').split('T')[0]
  const startIso = `${datePart}T${startTime}Z`
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

export type LengthRecommendations = {
  warmupRuns: number
  optimalAvgRuns: number
  optimalConsistentRuns: number
  optimalHighscoreRuns: number
}

export function recommendLengths(byIndex: { mean: number[]; std: number[] }, bestVsL: number[]): LengthRecommendations {
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

  // Optimal average: choose L maximizing cumulative mean of expected values; prefer smaller L within 1% of max
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
  let avgL = bestL
  for (let L = 1; L <= n; L++) {
    if (bestVal - cum[L - 1] <= eps) { avgL = L; break }
  }

  // Consistency: smallest L where recent std is below median of std
  let consL = n
  for (let L = 2; L <= n; L++) {
    const k = Math.min(3, L)
    const window = std.slice(L - k, L)
    const wMean = window.length ? window.reduce((a, b) => a + b, 0) / window.length : Infinity
    if (wMean <= stdMed) { consL = L; break }
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

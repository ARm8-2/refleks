import type { Session } from '../../types/domain'
import type { MetricsSeries } from '../analysis/metrics'
import { collectRunsBySession, expectedBestVsLength, expectedByIndex, recommendLengths } from '../analysis/sessionLength'

export type RecommendationInputs = {
  wantedNames: string[]
  byName: Map<string, MetricsSeries>
  lastPlayedMs: Map<string, number>
  lastSessionCount: Map<string, number>
  sessions: Session[]
}

// Numeric helpers
const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const stddev = (arr: number[]) => {
  if (!arr.length) return 0
  const m = mean(arr)
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length
  return Math.sqrt(v)
}
// Exponentially weighted slope (recent runs count more)
const weightedSlope = (arr: number[], alpha = 0.25): number => {
  const y = [...arr].reverse() // oldest -> newest
  const n = y.length
  if (n < 2) return 0
  const w: number[] = []
  for (let i = 0; i < n; i++) w.push(Math.exp(alpha * i))
  const sw = w.reduce((a, b) => a + b, 0)
  const mx = w.reduce((a, wi, i) => a + wi * (i + 1), 0) / sw
  const my = w.reduce((a, wi, i) => a + wi * (Number.isFinite(y[i]) ? y[i] : 0), 0) / sw
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const x = i + 1
    const yi = Number.isFinite(y[i]) ? y[i] : 0
    const dx = x - mx
    num += w[i] * dx * (yi - my)
    den += w[i] * dx * dx
  }
  return den === 0 ? 0 : num / den
}
const recentStd = (arr: number[], k = 6) => stddev(arr.slice(0, Math.min(k, arr.length)))

// Compute base recommendation score per scenario name, excluding threshold proximity.
export function computeRecommendationScores(input: RecommendationInputs): Map<string, number> {
  const { wantedNames, byName, lastPlayedMs, lastSessionCount, sessions } = input
  const now = Date.now()
  const out = new Map<string, number>()

  // Median total runs across the currently listed scenarios
  const counts: number[] = wantedNames.map(n => byName.get(n)?.score.length ?? 0)
  const sorted = counts.slice().sort((a, b) => a - b)
  const med = sorted.length ? (sorted[Math.floor(sorted.length / 2)] ?? 0) : 0

  for (const name of wantedNames) {
    const hist = byName.get(name)
    const histScores: number[] = hist?.score ?? []
    const histAcc: number[] = hist?.acc ?? []
    const histTtk: number[] = hist?.ttk ?? []

    // Trend signals (normalized by variability), weighted to prefer recent evidence
    const sSlope = weightedSlope(histScores)
    const sStd = stddev(histScores)
    const slopeNorm = sStd > 0 ? Math.max(-1, Math.min(1, sSlope / (3 * sStd))) : 0 // ~within +/-3σ per run
    const slopePts = 10 * slopeNorm // -10..+10

    const aSlope = weightedSlope(histAcc)
    const aStd = stddev(histAcc)
    const aNorm = aStd > 0 ? Math.max(-1, Math.min(1, aSlope / (3 * aStd))) : 0
    const accPts = 5 * aNorm // -5..+5

    const tSlope = weightedSlope(histTtk)
    const tStd = stddev(histTtk)
    const tNorm = tStd > 0 ? Math.max(-1, Math.min(1, tSlope / (3 * tStd))) : 0
    const ttkPts = -5 * tNorm // lower TTK is better

    // Plateau detection: flat trend and low recent variance
    const isPlateau = Math.abs(slopeNorm) < 0.05 && recentStd(histScores) < (0.25 * (sStd || 1))
    const plateauPts = isPlateau ? -10 : 0

    const playedMs = lastPlayedMs.get(name) ?? 0
    const hours = playedMs ? Math.max(0, (now - playedMs) / 3_600_000) : 999
    const recencyPts = Math.max(-5, Math.min(10, (hours - 4) / 4)) // negative if replayed very recently

    const inLastSess = lastSessionCount.get(name) ?? 0

    // Estimate optimal session length for this scenario if we have enough data
    let lenPts = 0
    try {
      const runs = collectRunsBySession(sessions, name)
      const byIdx = expectedByIndex(runs, 'score')
      const bestVsL = expectedBestVsLength(runs, 'score')
      const rec = recommendLengths(byIdx, bestVsL)
      const opt = rec.optimalAvgRuns || 0
      if (opt > 0) {
        if (inLastSess === 0) {
          lenPts = 0
        } else if (inLastSess < opt) {
          lenPts = Math.min(15, opt - inLastSess)
        } else if (inLastSess > opt) {
          lenPts = -Math.min(25, 2 * (inLastSess - opt))
        }
      }
    } catch { /* ignore */ }

    // Under-practiced bonus: encourage scenarios with few total runs
    const totalRuns = histScores.length
    let practicePts = 0
    if (totalRuns < Math.max(3, med)) {
      const denom = Math.max(1, med)
      practicePts = Math.max(0, Math.min(8, Math.round(8 * (1 - totalRuns / denom))))
    }

    const base = Math.round(slopePts + accPts + ttkPts + plateauPts + recencyPts + lenPts + practicePts)
    out.set(name, base)
  }

  return out
}

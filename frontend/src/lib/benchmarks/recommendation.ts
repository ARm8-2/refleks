import type { Session } from '../../types/domain'
import { getScenarioName } from '../utils'

export type ScenarioBenchmarkData = {
  rank: number
  score: number
  thresholds: number[]
}

export type RecommendationInputs = {
  wantedNames: string[]
  lastSessionCount: Map<string, number>
  sessions: Session[]
  benchmarkData: Map<string, ScenarioBenchmarkData>
}

// Constants for recommendation scoring
const THRESHOLD_VERY_WEAK = 0.15
const THRESHOLD_WEAK = 0.05
const THRESHOLD_AVERAGE = -0.05
const THRESHOLD_VERY_STRONG = -0.15

const SCORE_VERY_WEAK = 3
const SCORE_WEAK = 2
const SCORE_AVERAGE = 1
const SCORE_VERY_STRONG = -1
const SCORE_MAX_RANK_PENALTY = -3

const SLOPE_WORSE = -0.5
const SLOPE_PLATEAU = 0.1
const SLOPE_IMPROVING = 0.2

const SESSION_FATIGUE_HIGH = 12
const SESSION_FATIGUE_MED = 6

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

// Compute recommendation score per scenario name
// Returns a score roughly -3 to +5, where higher means "Focus on this".
export function computeRecommendationScores(input: RecommendationInputs): Map<string, number> {
  const { wantedNames, lastSessionCount, sessions, benchmarkData } = input
  const out = new Map<string, number>()

  // 1. Calculate Normalized Progress for all scenarios to find averages
  const progressMap = new Map<string, number>()
  let totalProgress = 0
  let count = 0

  for (const name of wantedNames) {
    const data = benchmarkData.get(name)
    if (!data) continue
    const { rank, score, thresholds } = data
    // Calculate normalized progress (0..1)
    const maxRank = Math.max(1, thresholds.length - 1)
    const r = Math.max(0, Math.min(rank, maxRank))

    let p = 0
    if (r >= maxRank) {
      p = 1
    } else {
      const prev = thresholds[r] ?? 0
      const next = thresholds[r + 1] ?? prev
      const range = next - prev
      const frac = range > 0 ? (score - prev) / range : 0
      p = (r + Math.max(0, Math.min(1, frac))) / maxRank
    }
    progressMap.set(name, p)
    totalProgress += p
    count++
  }

  const avgProgress = count > 0 ? totalProgress / count : 0

  for (const name of wantedNames) {
    let scoreVal = 0

    // --- Factor 1: Relative Weakness (The lower the progress, the higher the recommendation) ---
    const p = progressMap.get(name) ?? 1
    const diff = avgProgress - p // Positive if weaker than average

    if (diff > THRESHOLD_VERY_WEAK) scoreVal += SCORE_VERY_WEAK // Very weak
    else if (diff > THRESHOLD_WEAK) scoreVal += SCORE_WEAK // Weak
    else if (diff > THRESHOLD_AVERAGE) scoreVal += SCORE_AVERAGE // Average
    else if (diff < THRESHOLD_VERY_STRONG) scoreVal += SCORE_VERY_STRONG // Very strong compared to others -> mild suggestion to switch

    // Penalty for Max Rank
    if (p >= 1) {
      scoreVal += SCORE_MAX_RANK_PENALTY // Completed scenario -> Strong suggestion to switch
    }

    // --- Factor 2: Current Session Analysis ---
    const inSessionCount = lastSessionCount.get(name) ?? 0

    if (inSessionCount > 0) {
      // We are currently playing this scenario.
      // Check for fatigue/plateau in THIS session.

      const lastSession = sessions[0]
      if (lastSession) {
        // Filter items for this scenario
        const sessionRuns = lastSession.items.filter(it => getScenarioName(it) === name)

        if (sessionRuns.length >= 3) {
          const sessionScores = sessionRuns.map(r => Number(r.stats?.['Score'] ?? 0))
          const slope = weightedSlope(sessionScores)
          const std = stddev(sessionScores)
          const meanScore = mean(sessionScores)

          // If slope is negative (getting worse) -> Switch (-2)
          // Normalize slope by std or mean
          const normSlope = std > 0 ? slope / std : (meanScore > 0 ? slope / meanScore : 0)

          if (normSlope < SLOPE_WORSE) {
            scoreVal -= 2
          }
          // If slope is flat and low variance (Plateaued in session) -> Switch (-1)
          else if (Math.abs(normSlope) < SLOPE_PLATEAU) {
            scoreVal -= 1
          }
          // If improving -> Keep going (+1)
          else if (normSlope > SLOPE_IMPROVING) {
            scoreVal += 1
          }
        }

        // Diminishing returns: If played TOO much in one session
        if (inSessionCount > SESSION_FATIGUE_HIGH) scoreVal -= 2
        else if (inSessionCount > SESSION_FATIGUE_MED) scoreVal -= 1
      }
    } else {
      // Not played in this session.
      // If it's a weak scenario, we already have points.
      // Add a small bonus to encourage starting if it is weak
      if (diff > 0 && p < 1) scoreVal += 1
    }

    out.set(name, scoreVal)
  }

  return out
}

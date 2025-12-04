import type { Session } from '../../types/domain'
import type { ScenarioRecord } from '../../types/ipc'
import { getScenarioName } from '../utils'

export type SessionHealthLevel = 'optimal' | 'good' | 'declining' | 'fatigued'

export interface ScenarioProfile {
  name: string
  totalPlays: number
  recentPlays: number // plays in last 7 days
  mean: number
  std: number
  trend: number // overall improvement trend
  lastPlayedDaysAgo: number
  isWellPracticed: boolean // enough data to make reliable predictions
}

export interface SessionAnalysis {
  // Health assessment
  healthLevel: SessionHealthLevel
  healthMessage: string
  shouldTakeBreak: boolean

  // Session metrics
  totalRuns: number
  durationMinutes: number
  uniqueScenarios: number

  // Performance signals (all normalized 0-1 or -1 to 1)
  performanceTrend: number      // -1 to 1, negative = declining
  consistencyScore: number      // 0 to 1, how consistent are results
  fatigueConfidence: number     // 0 to 1, confidence that decline is fatigue

  // Contextual flags
  hasLearningCurveEffect: boolean
  hasInsufficientData: boolean

  // Per-scenario breakdown
  scenarioBreakdown: Map<string, {
    runs: number
    trend: number
    avgPercentile: number
  }>
}

export interface SessionLengthRecommendation {
  // Primary recommendation
  suggestedRuns: number
  confidence: 'low' | 'medium' | 'high'

  // Supporting data
  warmupRuns: number
  peakPerformanceWindow: [number, number] // [start, end] run indices
  diminishingReturnsAt: number

  // Data quality
  sessionsAnalyzed: number
  avgSessionLength: number
  dataQualityScore: number // 0-1

  // Insights
  insights: string[]
}

interface HistoricalProfile {
  scores: number[]
  timestamps: number[]
  mean: number
  std: number
  percentiles: number[] // p10, p25, p50, p75, p90
}

/**
 * Build comprehensive historical profiles for each scenario.
 * This includes mean, std, percentiles, and temporal information.
 */
export function buildScenarioProfiles(sessions: Session[]): Map<string, HistoricalProfile> {
  const profiles = new Map<string, HistoricalProfile>()
  const byScenario = new Map<string, { score: number; ts: number }[]>()

  // Collect all scores with timestamps
  for (const sess of sessions) {
    for (const item of sess.items) {
      const name = getScenarioName(item)
      const score = Number(item.stats['Score'] ?? NaN)
      const ts = Date.parse(String(item.stats['Date Played'] ?? ''))

      if (!Number.isFinite(score) || !Number.isFinite(ts)) continue

      const arr = byScenario.get(name) ?? []
      arr.push({ score, ts })
      byScenario.set(name, arr)
    }
  }

  // Build profiles
  for (const [name, data] of byScenario) {
    // Sort by timestamp (oldest first)
    data.sort((a, b) => a.ts - b.ts)

    const scores = data.map(d => d.score)
    const timestamps = data.map(d => d.ts)

    if (scores.length < 2) {
      profiles.set(name, {
        scores,
        timestamps,
        mean: scores[0] ?? 0,
        std: 1,
        percentiles: [scores[0] ?? 0, scores[0] ?? 0, scores[0] ?? 0, scores[0] ?? 0, scores[0] ?? 0]
      })
      continue
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length
    const std = Math.sqrt(variance) || 1

    const sorted = [...scores].sort((a, b) => a - b)
    const percentiles = [
      percentile(sorted, 10),
      percentile(sorted, 25),
      percentile(sorted, 50),
      percentile(sorted, 75),
      percentile(sorted, 90),
    ]

    profiles.set(name, { scores, timestamps, mean, std, percentiles })
  }

  return profiles
}

/**
 * Convert a raw score to a percentile rank (0-100) within the scenario's history.
 * This normalizes across different scoring systems.
 */
export function scoreToPercentile(score: number, profile: HistoricalProfile): number {
  if (!Number.isFinite(score) || profile.scores.length === 0) return 50

  const below = profile.scores.filter(s => s < score).length
  const equal = profile.scores.filter(s => s === score).length

  // Average percentile for ties
  return ((below + equal / 2) / profile.scores.length) * 100
}

/**
 * Detect if a scenario is in a "learning curve" phase for this user.
 * This happens when:
 * - Few total plays (< 15)
 * - Or recent improvement trend is strong (> 2 std per 10 plays)
 * - Or long gap since last play (muscle memory decay)
 */
export function detectLearningCurve(
  profile: HistoricalProfile,
  recentScores: number[]
): { isLearning: boolean; expectedImprovement: number } {
  const totalPlays = profile.scores.length

  // Not enough data - assume learning
  if (totalPlays < 10) {
    return { isLearning: true, expectedImprovement: 0.15 }
  }

  // Check recent improvement rate
  if (recentScores.length >= 3) {
    const recentMean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const oldMean = profile.mean
    const improvement = (recentMean - oldMean) / profile.std

    if (improvement > 0.5) {
      return { isLearning: true, expectedImprovement: improvement / recentScores.length }
    }
  }

  // Check for gap decay (last played > 7 days ago)
  if (profile.timestamps.length > 0) {
    const lastPlayed = profile.timestamps[profile.timestamps.length - 1]
    const daysSince = (Date.now() - lastPlayed) / (1000 * 60 * 60 * 24)

    if (daysSince > 7 && totalPlays < 30) {
      return { isLearning: true, expectedImprovement: 0.1 }
    }
  }

  return { isLearning: false, expectedImprovement: 0 }
}

/**
 * Analyze current session health by looking at performance trends
 * across all scenarios played in the session.
 *
 * Key insight: "Fatigue" should be distinguished from:
 * - Learning curves (improvement expected)
 * - Normal variance (bad day, some runs are just worse)
 * - Scenario switching effects
 */
export function analyzeSessionHealth(
  currentSession: Session | null,
  allSessions: Session[],
  profiles?: Map<string, HistoricalProfile>
): SessionAnalysis {
  const defaultResult: SessionAnalysis = {
    healthLevel: 'optimal',
    healthMessage: '',
    shouldTakeBreak: false,
    totalRuns: 0,
    durationMinutes: 0,
    uniqueScenarios: 0,
    performanceTrend: 0,
    consistencyScore: 1,
    fatigueConfidence: 0,
    hasLearningCurveEffect: false,
    hasInsufficientData: true,
    scenarioBreakdown: new Map(),
  }

  if (!currentSession || currentSession.items.length === 0) {
    return defaultResult
  }

  // Build profiles if not provided
  const scenarioProfiles = profiles ?? buildScenarioProfiles(allSessions)

  // Basic session metrics
  const startTs = Date.parse(currentSession.start)
  const endTs = Date.parse(currentSession.end)
  const durationMinutes = Math.abs(endTs - startTs) / 60000
  const totalRuns = currentSession.items.length

  // Group items by scenario (items come newest-first)
  const byScenario = new Map<string, ScenarioRecord[]>()
  for (const item of currentSession.items) {
    const name = getScenarioName(item)
    const arr = byScenario.get(name) ?? []
    arr.push(item)
    byScenario.set(name, arr)
  }

  const uniqueScenarios = byScenario.size

  // Analyze each scenario
  const scenarioBreakdown = new Map<string, { runs: number; trend: number; avgPercentile: number }>()
  const allPercentiles: number[] = []
  const percentileTrends: number[] = [] // Per-scenario trends, weighted by run count
  let hasLearningCurve = false
  let scenariosWithEnoughData = 0

  for (const [name, items] of byScenario) {
    const profile = scenarioProfiles.get(name)
    if (!profile || profile.scores.length < 5) continue // Need baseline data

    scenariosWithEnoughData++

    // Convert scores to percentiles (newest first in items, reverse for chronological)
    const chronological = [...items].reverse()
    const percentiles = chronological.map(it => {
      const score = Number(it.stats['Score'] ?? NaN)
      return scoreToPercentile(score, profile)
    })

    // Check for learning curve
    const scores = chronological.map(it => Number(it.stats['Score'] ?? 0))
    const { isLearning } = detectLearningCurve(profile, scores)
    if (isLearning) hasLearningCurve = true

    // Calculate trend within this session for this scenario
    const trend = calculateTrend(percentiles)
    const avgPercentile = percentiles.reduce((a, b) => a + b, 0) / percentiles.length

    scenarioBreakdown.set(name, {
      runs: items.length,
      trend,
      avgPercentile,
    })

    allPercentiles.push(...percentiles)
    if (items.length >= 2) {
      percentileTrends.push(trend * items.length) // Weight by run count
    }
  }

  // Calculate aggregate metrics
  const hasInsufficientData = scenariosWithEnoughData < 1 || totalRuns < 4

  let performanceTrend = 0
  if (percentileTrends.length > 0) {
    const totalWeight = Array.from(scenarioBreakdown.values()).reduce((s, v) => s + v.runs, 0)
    performanceTrend = percentileTrends.reduce((a, b) => a + b, 0) / totalWeight
  }

  // Calculate consistency (how much variance in percentiles)
  let consistencyScore = 1
  if (allPercentiles.length >= 3) {
    const pMean = allPercentiles.reduce((a, b) => a + b, 0) / allPercentiles.length
    const pStd = Math.sqrt(
      allPercentiles.reduce((s, p) => s + (p - pMean) ** 2, 0) / allPercentiles.length
    )
    // Convert std to 0-1 score (std of 25 percentile points = 0.5 consistency)
    consistencyScore = Math.max(0, 1 - pStd / 50)
  }

  // Calculate fatigue confidence
  // High confidence requires: negative trend + below-average recent performance + enough data
  let fatigueConfidence = 0
  if (!hasInsufficientData && totalRuns >= 5) {
    const recentPercentiles = allPercentiles.slice(-Math.min(5, allPercentiles.length))
    const recentAvg = recentPercentiles.reduce((a, b) => a + b, 0) / recentPercentiles.length

    // Factors that increase fatigue confidence
    const trendFactor = Math.max(0, -performanceTrend * 2) // 0 to 1
    const belowAvgFactor = Math.max(0, (50 - recentAvg) / 50) // 0 to 1
    const sessionLengthFactor = Math.min(1, totalRuns / 15) // Longer sessions more likely fatigued
    const durationFactor = Math.min(1, durationMinutes / 60) // Time also matters

    // Factors that decrease confidence
    const learningDiscount = hasLearningCurve ? 0.5 : 1 // Learning curves look like fatigue but aren't
    const varianceDiscount = consistencyScore // High variance = less confident

    fatigueConfidence = (
      (trendFactor * 0.4 + belowAvgFactor * 0.3 + sessionLengthFactor * 0.2 + durationFactor * 0.1)
      * learningDiscount
      * varianceDiscount
    )
  }

  // Determine health level
  let healthLevel: SessionHealthLevel = 'optimal'
  let healthMessage = ''
  let shouldTakeBreak = false

  if (hasInsufficientData) {
    healthLevel = 'good'
    healthMessage = 'Keep playing to build performance insights'
  } else if (fatigueConfidence > 0.7 && performanceTrend < -0.1) {
    healthLevel = 'fatigued'
    healthMessage = 'Performance declining significantly – consider taking a break'
    shouldTakeBreak = true
  } else if (fatigueConfidence > 0.5 || (performanceTrend < -0.15 && totalRuns >= 6)) {
    healthLevel = 'declining'
    healthMessage = 'Performance trending down – a short break might help'
  } else if (performanceTrend > 0.05) {
    healthLevel = 'optimal'
    healthMessage = 'Great session! Performance is improving'
  } else if (performanceTrend > -0.05) {
    healthLevel = 'good'
    healthMessage = 'Consistent performance'
  } else {
    healthLevel = 'good'
    healthMessage = 'Slight variance in performance – this is normal'
  }

  // Extended session warning
  if (healthLevel !== 'fatigued' && totalRuns >= 20 && durationMinutes >= 60) {
    healthLevel = 'declining'
    healthMessage = 'Long session – regular breaks help maintain focus'
  }

  return {
    healthLevel,
    healthMessage,
    shouldTakeBreak,
    totalRuns,
    durationMinutes,
    uniqueScenarios,
    performanceTrend,
    consistencyScore,
    fatigueConfidence,
    hasLearningCurveEffect: hasLearningCurve,
    hasInsufficientData,
    scenarioBreakdown,
  }
}

/**
 * Analyze historical sessions to recommend optimal session length.
 * This looks at patterns across ALL scenarios, not just one.
 *
 * Key insights we look for:
 * - Warm-up period: how many runs before reaching typical performance
 * - Peak window: where does performance tend to be best
 * - Diminishing returns: when do extra runs stop helping
 */
export function recommendSessionLength(
  sessions: Session[],
  profiles?: Map<string, HistoricalProfile>
): SessionLengthRecommendation {
  const defaultResult: SessionLengthRecommendation = {
    suggestedRuns: 8,
    confidence: 'low',
    warmupRuns: 2,
    peakPerformanceWindow: [3, 10],
    diminishingReturnsAt: 12,
    sessionsAnalyzed: 0,
    avgSessionLength: 0,
    dataQualityScore: 0,
    insights: ['Play more sessions to get personalized recommendations'],
  }

  if (sessions.length < 3) {
    return defaultResult
  }

  // Build profiles if not provided
  const scenarioProfiles = profiles ?? buildScenarioProfiles(sessions)

  // Analyze each session's performance curve
  const sessionCurves: { percentiles: number[]; length: number }[] = []

  for (const sess of sessions) {
    if (sess.items.length < 3) continue

    // Order items chronologically (oldest first)
    const ordered = [...sess.items].sort((a, b) => {
      const ta = Date.parse(String(a.stats['Date Played'] ?? ''))
      const tb = Date.parse(String(b.stats['Date Played'] ?? ''))
      return ta - tb
    })

    // Convert each run to percentile
    const percentiles: number[] = []
    for (const item of ordered) {
      const name = getScenarioName(item)
      const profile = scenarioProfiles.get(name)
      if (!profile || profile.scores.length < 5) continue

      const score = Number(item.stats['Score'] ?? NaN)
      if (!Number.isFinite(score)) continue

      percentiles.push(scoreToPercentile(score, profile))
    }

    if (percentiles.length >= 3) {
      sessionCurves.push({ percentiles, length: ordered.length })
    }
  }

  if (sessionCurves.length < 3) {
    return {
      ...defaultResult,
      sessionsAnalyzed: sessionCurves.length,
      insights: ['Need more sessions with at least 3 tracked runs each'],
    }
  }

  // Calculate statistics by run index
  const maxLen = Math.max(...sessionCurves.map(s => s.percentiles.length))
  const byIndex: { values: number[]; mean: number; std: number }[] = []

  for (let i = 0; i < maxLen; i++) {
    const values: number[] = []
    for (const curve of sessionCurves) {
      if (i < curve.percentiles.length) {
        values.push(curve.percentiles[i])
      }
    }
    if (values.length >= 2) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
      byIndex.push({ values, mean, std })
    }
  }

  if (byIndex.length < 3) {
    return {
      ...defaultResult,
      sessionsAnalyzed: sessionCurves.length,
    }
  }

  // Find warm-up period (where mean crosses overall median)
  const overallMean = byIndex.reduce((s, b) => s + b.mean, 0) / byIndex.length
  let warmupRuns = 1
  for (let i = 0; i < byIndex.length; i++) {
    if (byIndex[i].mean >= overallMean * 0.95) {
      warmupRuns = i + 1
      break
    }
  }
  warmupRuns = Math.max(1, Math.min(warmupRuns, 5)) // Cap at 5

  // Find peak performance window
  let peakStart = warmupRuns
  let peakEnd = byIndex.length
  let bestWindow = { start: peakStart, end: peakEnd, avgPerf: 0 }

  // Sliding window to find best 5-run segment
  const windowSize = Math.min(5, byIndex.length - warmupRuns)
  for (let start = warmupRuns - 1; start <= byIndex.length - windowSize; start++) {
    const windowMeans = byIndex.slice(start, start + windowSize).map(b => b.mean)
    const avgPerf = windowMeans.reduce((a, b) => a + b, 0) / windowMeans.length
    if (avgPerf > bestWindow.avgPerf) {
      bestWindow = { start: start + 1, end: start + windowSize, avgPerf }
    }
  }
  peakStart = bestWindow.start
  peakEnd = bestWindow.end

  // Find diminishing returns point (where improvement per run drops below threshold)
  let diminishingAt = byIndex.length
  for (let i = warmupRuns; i < byIndex.length - 1; i++) {
    const current = byIndex[i].mean
    const next = byIndex[i + 1].mean
    const improvement = next - current

    // Less than 1 percentile point improvement
    if (improvement < 1 && i >= peakEnd) {
      diminishingAt = i + 1
      break
    }
  }

  // Calculate suggested runs
  const avgSessionLength = sessionCurves.reduce((s, c) => s + c.length, 0) / sessionCurves.length

  // Suggested = end of peak window, capped by diminishing returns
  let suggestedRuns = Math.min(peakEnd + 2, diminishingAt)
  suggestedRuns = Math.max(suggestedRuns, warmupRuns + 3) // At least warm-up + 3
  suggestedRuns = Math.round(suggestedRuns)

  // Data quality score
  const dataQualityScore = Math.min(1, sessionCurves.length / 10) * Math.min(1, avgSessionLength / 8)
  const confidence: 'low' | 'medium' | 'high' =
    dataQualityScore > 0.7 ? 'high' : dataQualityScore > 0.4 ? 'medium' : 'low'

  // Generate insights
  const insights: string[] = []

  if (warmupRuns > 1) {
    insights.push(`First ${warmupRuns} runs are typically warm-up`)
  }

  if (peakEnd - peakStart >= 3) {
    insights.push(`Peak performance usually between runs ${peakStart}–${peakEnd}`)
  }

  if (diminishingAt < avgSessionLength) {
    insights.push(`Extra runs beyond ${diminishingAt} show diminishing returns`)
  }

  if (sessionCurves.length < 8) {
    insights.push('More sessions will improve recommendation accuracy')
  }

  return {
    suggestedRuns,
    confidence,
    warmupRuns,
    peakPerformanceWindow: [peakStart, peakEnd],
    diminishingReturnsAt: diminishingAt,
    sessionsAnalyzed: sessionCurves.length,
    avgSessionLength: Math.round(avgSessionLength),
    dataQualityScore,
    insights,
  }
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))]
}

/**
 * Calculate trend in a series of values.
 * Returns normalized slope (-1 to 1 range typically)
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - xMean
    const dy = values[i] - yMean
    num += dx * dy
    den += dx * dx
  }

  if (den === 0) return 0

  // Normalize by the range of y values
  const yRange = Math.max(...values) - Math.min(...values) || 1
  const slope = num / den

  return slope / yRange * 10 // Scale to roughly -1 to 1
}

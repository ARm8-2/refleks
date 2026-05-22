import type { Session } from '@/shared/types'
import { getScenarioName } from './detailFormatting'

export type ScenarioBenchmarkData = {
  rank: number
  score: number
  thresholds: number[]
  category?: string
}

export type RecommendationInputs = {
  wantedNames: string[]
  lastSessionCount: Map<string, number>
  sessions: Session[]
  benchmarkData: Map<string, ScenarioBenchmarkData>
}

const mean = (arr: number[]) => (arr.length ? arr.reduce((sum, item) => sum + item, 0) / arr.length : 0)

const stddev = (arr: number[]) => {
  if (!arr.length) return 0
  const avg = mean(arr)
  const variance = arr.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / arr.length
  return Math.sqrt(variance)
}

const weightedSlope = (arr: number[], alpha = 0.25): number => {
  const ordered = [...arr].reverse() // oldest -> newest
  const length = ordered.length
  if (length < 2) return 0

  const weights = Array.from({ length }, (_, index) => Math.exp(alpha * index))
  const sumWeights = weights.reduce((sum, weight) => sum + weight, 0)
  const avgX = weights.reduce((sum, weight, index) => sum + weight * (index + 1), 0) / sumWeights
  const avgY = weights.reduce(
    (sum, weight, index) => sum + weight * (Number.isFinite(ordered[index]) ? ordered[index] : 0),
    0,
  ) / sumWeights

  let numerator = 0
  let denominator = 0

  for (let index = 0; index < length; index++) {
    const x = index + 1
    const y = Number.isFinite(ordered[index]) ? ordered[index] : 0
    const delta = x - avgX
    numerator += weights[index] * delta * (y - avgY)
    denominator += weights[index] * delta * delta
  }

  return denominator === 0 ? 0 : numerator / denominator
}

function calculateProgress(rank: number, score: number, thresholds: number[]): number {
  const totalRanks = thresholds.length
  if (totalRanks === 0) return 0
  if (rank >= totalRanks - 1) return 1

  let previous = 0
  let next = 0
  let baseRank = -1

  if (rank < 0) {
    next = thresholds[0] || 0
  } else {
    previous = thresholds[rank]
    next = thresholds[rank + 1] || previous
    baseRank = rank
  }

  const range = next - previous
  const fraction = range > 0 ? (score - previous) / range : 0
  return (baseRank + Math.max(0, Math.min(1, fraction))) / totalRanks
}

export function computeRecommendationScores(input: RecommendationInputs): Map<string, number> {
  const { wantedNames, lastSessionCount, sessions, benchmarkData } = input
  const wantedSet = new Set(wantedNames)
  const now = Date.now()
  const result = new Map<string, number>()

  const progressMap = new Map<string, number>()
  const progressList: number[] = []

  for (const name of wantedNames) {
    const data = benchmarkData.get(name)
    if (!data) continue

    const progress = calculateProgress(data.rank, data.score, data.thresholds)
    progressMap.set(name, progress)
    progressList.push(progress)
  }

  const played = progressList.filter(progress => progress > 0)
  const sortedPlayed = [...played].sort((a, b) => a - b)

  const medianProgress = sortedPlayed.length
    ? sortedPlayed[Math.floor(sortedPlayed.length / 2)] ?? 0.5
    : 0.5

  const averageProgress = played.length
    ? played.reduce((sum, progress) => sum + progress, 0) / played.length
    : 0.5

  const historyMap = new Map<string, { time: number; score: number }[]>()
  for (let sessionIndex = 0; sessionIndex < Math.min(sessions.length, 50); sessionIndex++) {
    const session = sessions[sessionIndex]
    const sessionTime = new Date(session.start).getTime()

    for (const item of session.items) {
      const name = getScenarioName(item)
      if (!wantedSet.has(name)) continue

      const score = Number(item.stats?.summary.score ?? 0)
      if (!historyMap.has(name)) historyMap.set(name, [])
      historyMap.get(name)?.push({ time: sessionTime, score })
    }
  }

  for (const name of wantedNames) {
    const progress = progressMap.get(name) ?? 0
    const data = benchmarkData.get(name)
    const history = historyMap.get(name) || []
    const hasProgress = progress > 0
    let score = 0

    if (hasProgress) {
      const medianDiff = medianProgress - progress
      const avgDiff = averageProgress - progress
      const progressDiff = medianDiff * 0.5 + avgDiff * 0.5

      score += progressDiff * 30
      if (progressDiff > 0.2) score += 2
    }

    if (progress >= 1) score -= 8

    if (history.length >= 3) {
      const recentScores = history.slice(0, Math.min(10, history.length)).map(entry => entry.score)
      const slope = weightedSlope(recentScores)
      const spread = stddev(recentScores)

      const normalizedSlope = spread > 0 ? Math.max(-1, Math.min(1, slope / (3 * spread))) : 0
      score += normalizedSlope * 4

      const recentSpread = stddev(recentScores.slice(0, Math.min(6, recentScores.length)))
      const isPlateau = Math.abs(normalizedSlope) < 0.05 && recentSpread < (0.25 * (spread || 1))
      if (isPlateau) {
        const progressDiff = hasProgress ? medianProgress - progress : 0
        score += progressDiff > 0.1 ? 1 : -3
      }
    }

    const lastPlayed = history.length > 0 ? history[0].time : 0
    if (lastPlayed > 0) {
      const hoursSince = (now - lastPlayed) / (1000 * 60 * 60)
      score += Math.max(-3, Math.min(3, (hoursSince - 12) / 12))
    } else if (hasProgress) {
      score += 1
    }

    const playedThisSession = lastSessionCount.get(name) ?? 0
    if (playedThisSession > 0) {
      score -= Math.min(10, playedThisSession * 1.5)
    }

    if (data && progress < 1) {
      const maxRank = Math.max(1, data.thresholds.length - 1)
      const currentRank = Math.max(0, Math.min(data.rank, maxRank))
      const next = data.thresholds[currentRank + 1] ?? data.thresholds[currentRank]
      const previous = data.thresholds[currentRank] ?? 0
      const range = next - previous

      if (range > 0) {
        const distancePercent = (next - data.score) / range
        if (distancePercent < 0.05) score += 2
        else if (distancePercent < 0.15) score += 1
      }
    }

    result.set(name, Math.round(score))
  }

  return result
}

export function selectTopPicks(
  recommendationScore: Map<string, number>,
  scenarioCategoryMap: Map<string, string>,
  maxPicks: number,
): Set<string> {
  const entries = Array.from(recommendationScore.entries())
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1])

  if (!entries.length) return new Set<string>()

  const topScore = entries[0][1]
  const candidates = entries.filter(([, score]) => score >= topScore - 1.5)

  const selected = new Set<string>()
  const selectedCategories = new Set<string>()

  for (const [name] of candidates) {
    if (selected.size >= maxPicks) break
    const category = scenarioCategoryMap.get(name)
    if (category && !selectedCategories.has(category)) {
      selected.add(name)
      selectedCategories.add(category)
    }
  }

  if (selected.size < maxPicks) {
    for (const [name] of candidates) {
      if (selected.size >= maxPicks) break
      if (!selected.has(name)) selected.add(name)
    }
  }

  return selected
}

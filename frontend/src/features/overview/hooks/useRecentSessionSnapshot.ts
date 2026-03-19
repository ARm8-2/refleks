import { getScenarioName } from '@/features/benchmarks/lib/detailFormatting'
import { useStore } from '@/shared/hooks'
import type { ScenarioRecord, Session } from '@/shared/types'
import { useMemo } from 'react'

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export type SnapshotTone = 'success' | 'warning' | 'neutral' | 'muted'

type SessionLengthRecommendation = {
  suggestedRuns: number
  confidence: 'low' | 'medium' | 'high'
  warmupRuns: number
  peakPerformanceWindow: [number, number]
  diminishingReturnsAt: number
  sessionsAnalyzed: number
  avgSessionLength: number
}

type ScenarioProfile = {
  scores: number[]
}

export type RecentSessionSnapshot = {
  currentSession: Session | null
  isInSession: boolean
  statusTone: SnapshotTone
  statusLabel: string
  latestSessionLabel: string
  sessionLengthLabel: string
  sessionLengthDetail: string
  activePlaytimeLabel: string
  activePlaytimeDetail: string
  streakLabel: string
  streakDetail: string
  performanceValue: string
  performanceDetail: string
  currentRuns: number
  suggestedRuns: number
  warmupRuns: number
  peakStart: number
  peakEnd: number
  diminishingReturnsAt: number
  sessionsAnalyzed: number
}

type PerformanceRead = {
  tone: SnapshotTone
  label: string
  value: string
  detail: string
}

export function useRecentSessionSnapshot(): RecentSessionSnapshot {
  const sessions = useStore(state => state.sessions)
  const isInSession = useStore(state => state.isInSession)

  return useMemo(() => {
    const currentSession = sessions[0] ?? null

    if (!currentSession || currentSession.items.length === 0) {
      return {
        currentSession: null,
        isInSession,
        statusTone: 'muted',
        statusLabel: 'No session',
        latestSessionLabel: '--',
        sessionLengthLabel: '--',
        sessionLengthDetail: 'No session loaded',
        activePlaytimeLabel: '--',
        activePlaytimeDetail: 'No run duration data',
        streakLabel: '--',
        streakDetail: 'No recent activity',
        performanceValue: '--',
        performanceDetail: 'Need more history',
        currentRuns: 0,
        suggestedRuns: 8,
        warmupRuns: 2,
        peakStart: 3,
        peakEnd: 10,
        diminishingReturnsAt: 12,
        sessionsAnalyzed: 0,
      }
    }

    const lastPlayedAt = readSessionEndTimestamp(currentSession)
    const sessionLengthMs = readSessionLengthMs(currentSession)
    const activePlaytimeMs = sumSessionPlaytimeMs(currentSession)
    const focusRatio = activePlaytimeMs > 0
      ? activePlaytimeMs / Math.max(activePlaytimeMs, sessionLengthMs)
      : 0
    const activityStats = calculateActivityStats(currentSession, sessions)
    const performance = readPerformance(currentSession, sessions.slice(1))
    const recommendation = recommendSessionLength(sessions)
    const currentRuns = currentSession.items.length

    return {
      currentSession,
      isInSession,
      statusTone: performance.tone,
      statusLabel: performance.label,
      latestSessionLabel: formatTimestamp(lastPlayedAt),
      sessionLengthLabel: formatDuration(sessionLengthMs),
      sessionLengthDetail: isInSession ? 'Elapsed so far' : 'Latest session window',
      activePlaytimeLabel: formatDuration(activePlaytimeMs),
      activePlaytimeDetail: focusRatio > 0
        ? `${Math.round(focusRatio * 100)}% active`
        : 'No run duration data',
      streakLabel: `${activityStats.streak} ${pluralize('day', activityStats.streak)}`,
      streakDetail: `${formatDuration(activityStats.playtimeMs)} today`,
      performanceValue: performance.value,
      performanceDetail: performance.tone === 'muted' ? 'Need more history' : performance.label,
      currentRuns,
      suggestedRuns: recommendation.suggestedRuns,
      warmupRuns: recommendation.warmupRuns,
      peakStart: recommendation.peakPerformanceWindow[0],
      peakEnd: recommendation.peakPerformanceWindow[1],
      diminishingReturnsAt: recommendation.diminishingReturnsAt,
      sessionsAnalyzed: recommendation.sessionsAnalyzed,
    }
  }, [isInSession, sessions])
}

function calculateActivityStats(currentSession: Session, allSessions: Session[]) {
  const targetDate = new Date(readSessionEndTimestamp(currentSession))
  const activityDays = new Set<string>()
  let playtimeMs = 0

  for (const session of allSessions) {
    for (const item of session.items) {
      const ts = readScenarioTimestamp(item)
      if (ts <= 0) continue

      const itemDate = new Date(ts)
      const itemKey = toDayKey(itemDate)
      activityDays.add(itemKey)

      if (itemKey === toDayKey(targetDate)) {
        playtimeMs += readScenarioDurationMs(item)
      }
    }
  }

  let streak = 0
  const cursor = startOfDay(targetDate)

  while (activityDays.has(toDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    playtimeMs,
    streak,
  }
}

function readPerformance(currentSession: Session, previousSessions: Session[]): PerformanceRead {
  const historyByScenario = new Map<string, number[]>()

  for (const session of previousSessions) {
    for (const item of session.items) {
      const name = getScenarioName(item).trim()
      const score = readScenarioScore(item)

      if (!name || score <= 0) continue

      const existing = historyByScenario.get(name)
      if (existing) {
        existing.push(score)
      } else {
        historyByScenario.set(name, [score])
      }
    }
  }

  const comparableDeltas: number[] = []

  for (const item of currentSession.items) {
    const name = getScenarioName(item).trim()
    const score = readScenarioScore(item)
    const history = historyByScenario.get(name)

    if (!name || score <= 0 || !history || history.length < 3) continue

    const baseline = median(history)
    if (baseline <= 0) continue

    comparableDeltas.push(clamp((score - baseline) / baseline, -0.35, 0.35))
  }

  if (comparableDeltas.length >= 2) {
    const delta = average(comparableDeltas)
    return {
      tone: toneFromDelta(delta),
      label: labelFromHistoryDelta(delta),
      value: formatSignedPercent(delta),
      detail: `${labelFromHistoryDelta(delta)} across ${comparableDeltas.length} comparable ${pluralize('run', comparableDeltas.length)}`,
    }
  }

  const repeatDelta = readWithinSessionTrend(currentSession.items)
  if (repeatDelta !== null) {
    return {
      tone: toneFromDelta(repeatDelta),
      label: labelFromRepeatDelta(repeatDelta),
      value: formatSignedPercent(repeatDelta),
      detail: `${labelFromRepeatDelta(repeatDelta)} based on repeated scenarios in this session`,
    }
  }

  return {
    tone: 'muted',
    label: 'Building signal',
    value: '--',
    detail: 'Need older comparison runs or repeated scenarios',
  }
}

function recommendSessionLength(sessions: Session[]): SessionLengthRecommendation {
  const defaultResult: SessionLengthRecommendation = {
    suggestedRuns: 8,
    confidence: 'low',
    warmupRuns: 2,
    peakPerformanceWindow: [3, 10],
    diminishingReturnsAt: 12,
    sessionsAnalyzed: 0,
    avgSessionLength: 0,
  }

  if (sessions.length < 3) {
    return defaultResult
  }

  const scenarioProfiles = buildScenarioProfiles(sessions)
  const validLengths = sessions
    .map(session => session.items.length)
    .filter(length => length >= 3)
    .sort((left, right) => left - right)

  let minLengthThreshold = 3
  if (validLengths.length >= 5) {
    const mid = Math.floor(validLengths.length / 2)
    const medianLength = validLengths.length % 2 !== 0
      ? validLengths[mid]
      : (validLengths[mid - 1] + validLengths[mid]) / 2

    minLengthThreshold = Math.max(3, Math.floor(medianLength * 0.4))
  }

  const sessionCurves: Array<{ percentiles: number[]; length: number; weight: number }> = []

  for (const session of sessions) {
    if (session.items.length < minLengthThreshold) continue

    const ordered = [...session.items].sort((left, right) => readScenarioTimestamp(left) - readScenarioTimestamp(right))
    const percentiles: number[] = []

    for (const item of ordered) {
      const name = getScenarioName(item).trim()
      const score = readScenarioScore(item)
      const profile = scenarioProfiles.get(name)

      if (!name || score <= 0 || !profile || profile.scores.length < 5) continue
      percentiles.push(scoreToPercentile(score, profile))
    }

    if (percentiles.length < 3) continue

    const mean = average(percentiles)
    const variance = average(percentiles.map(value => (value - mean) ** 2))
    const std = Math.sqrt(variance)
    const weight = 100 / (std + 10)

    sessionCurves.push({
      percentiles,
      length: percentiles.length,
      weight,
    })
  }

  if (sessionCurves.length < 3) {
    return {
      ...defaultResult,
      sessionsAnalyzed: sessionCurves.length,
      avgSessionLength: Math.round(average(sessionCurves.map(curve => curve.length))),
    }
  }

  const maxLength = Math.max(...sessionCurves.map(curve => curve.percentiles.length))
  const minDataPoints = Math.max(2, Math.floor(sessionCurves.length * 0.15))
  const byIndex: Array<{ mean: number }> = []

  for (let index = 0; index < maxLength; index += 1) {
    const values: number[] = []
    let sumWeighted = 0
    let sumWeights = 0

    for (const curve of sessionCurves) {
      if (index >= curve.percentiles.length) continue

      const value = curve.percentiles[index]
      values.push(value)
      sumWeighted += value * curve.weight
      sumWeights += curve.weight
    }

    if (values.length < minDataPoints || sumWeights === 0) break

    byIndex.push({
      mean: sumWeighted / sumWeights,
    })
  }

  if (byIndex.length < 3) {
    return {
      ...defaultResult,
      sessionsAnalyzed: sessionCurves.length,
      avgSessionLength: Math.round(average(sessionCurves.map(curve => curve.length))),
    }
  }

  const smoothedMeans = byIndex.map((entry, index) => {
    if (index === 0 || index === byIndex.length - 1) {
      return entry.mean
    }

    return (byIndex[index - 1].mean + entry.mean + byIndex[index + 1].mean) / 3
  })

  const overallMean = average(smoothedMeans)
  let warmupRuns = 1
  for (let index = 0; index < smoothedMeans.length; index += 1) {
    if (smoothedMeans[index] >= overallMean * 0.95) {
      warmupRuns = index + 1
      break
    }
  }
  warmupRuns = Math.max(1, Math.min(warmupRuns, 5))

  const windowSize = Math.max(1, Math.min(5, smoothedMeans.length - warmupRuns + 1))
  let peakStart = warmupRuns
  let peakEnd = Math.min(smoothedMeans.length, peakStart + windowSize - 1)
  let bestWindowAverage = Number.NEGATIVE_INFINITY

  for (let start = warmupRuns - 1; start <= smoothedMeans.length - windowSize; start += 1) {
    const windowMeans = smoothedMeans.slice(start, start + windowSize)
    const windowAverage = average(windowMeans)

    if (windowAverage > bestWindowAverage) {
      bestWindowAverage = windowAverage
      peakStart = start + 1
      peakEnd = start + windowSize
    }
  }

  let diminishingReturnsAt = smoothedMeans.length
  for (let index = warmupRuns; index < smoothedMeans.length - 1; index += 1) {
    const improvement = smoothedMeans[index + 1] - smoothedMeans[index]
    if (improvement < 0.5 && index + 1 >= peakEnd) {
      diminishingReturnsAt = index + 1
      break
    }
  }

  const avgSessionLength = Math.round(average(sessionCurves.map(curve => curve.length)))
  let suggestedRuns = Math.min(peakEnd + 2, diminishingReturnsAt)
  suggestedRuns = Math.max(suggestedRuns, warmupRuns + 3)
  suggestedRuns = Math.round(suggestedRuns)

  const qualityScore = Math.min(1, sessionCurves.length / 10) * Math.min(1, avgSessionLength / 8)
  const confidence: 'low' | 'medium' | 'high' = qualityScore > 0.7
    ? 'high'
    : qualityScore > 0.4
      ? 'medium'
      : 'low'

  return {
    suggestedRuns,
    confidence,
    warmupRuns,
    peakPerformanceWindow: [peakStart, peakEnd],
    diminishingReturnsAt,
    sessionsAnalyzed: sessionCurves.length,
    avgSessionLength,
  }
}

function buildScenarioProfiles(sessions: Session[]): Map<string, ScenarioProfile> {
  const byScenario = new Map<string, number[]>()

  for (const session of sessions) {
    for (const item of session.items) {
      const name = getScenarioName(item).trim()
      const score = readScenarioScore(item)

      if (!name || score <= 0) continue

      const existing = byScenario.get(name)
      if (existing) {
        existing.push(score)
      } else {
        byScenario.set(name, [score])
      }
    }
  }

  const profiles = new Map<string, ScenarioProfile>()
  for (const [name, scores] of byScenario) {
    profiles.set(name, { scores })
  }

  return profiles
}

function scoreToPercentile(score: number, profile: ScenarioProfile): number {
  if (!Number.isFinite(score) || profile.scores.length === 0) return 50

  let below = 0
  let equal = 0
  for (const value of profile.scores) {
    if (value < score) {
      below += 1
    } else if (value === score) {
      equal += 1
    }
  }

  return ((below + equal / 2) / profile.scores.length) * 100
}

function readWithinSessionTrend(items: ScenarioRecord[]): number | null {
  const scenarioScores = new Map<string, number[]>()

  for (const item of [...items].reverse()) {
    const name = getScenarioName(item).trim()
    const score = readScenarioScore(item)

    if (!name || score <= 0) continue

    const existing = scenarioScores.get(name)
    if (existing) {
      existing.push(score)
    } else {
      scenarioScores.set(name, [score])
    }
  }

  let totalWeight = 0
  let weightedDelta = 0

  for (const scores of scenarioScores.values()) {
    if (scores.length < 2) continue

    const first = scores[0]
    const last = scores[scores.length - 1]
    const delta = clamp((last - first) / Math.max(first, 1), -0.35, 0.35)
    const weight = scores.length - 1

    totalWeight += weight
    weightedDelta += delta * weight
  }

  if (totalWeight === 0) {
    return null
  }

  return weightedDelta / totalWeight
}

function readSessionLengthMs(session: Session): number {
  const start = Date.parse(session.start)
  const end = Date.parse(session.end)

  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return end - start
  }

  const timestamps = session.items.map(readScenarioTimestamp).filter(ts => ts > 0)
  if (timestamps.length === 0) return 0
  return Math.max(...timestamps) - Math.min(...timestamps)
}

function readSessionEndTimestamp(session: Session): number {
  const end = Date.parse(session.end)
  if (Number.isFinite(end) && end > 0) return end

  const timestamps = session.items.map(readScenarioTimestamp).filter(ts => ts > 0)
  return timestamps.length > 0 ? Math.max(...timestamps) : Date.now()
}

function sumSessionPlaytimeMs(session: Session): number {
  return session.items.reduce((sum, item) => sum + readScenarioDurationMs(item), 0)
}

function readScenarioScore(item: ScenarioRecord): number {
  const score = Number(item.stats?.['Score'] ?? 0)
  return Number.isFinite(score) ? score : 0
}

function readScenarioTimestamp(item: ScenarioRecord): number {
  const raw = item.stats?.['Date Played']
  if (!raw) return 0

  const timestamp = Date.parse(String(raw))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function readScenarioDurationMs(item: ScenarioRecord): number {
  const seconds = Number(item.stats?.['Duration'] ?? 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return seconds * 1000
}

function formatTimestamp(timestamp: number): string {
  if (timestamp <= 0) return 'Unknown time'
  return dateTimeFormatter.format(new Date(timestamp))
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '<1m'

  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 1) return '<1m'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatSignedPercent(value: number): string {
  const percent = value * 100
  const fixed = Math.abs(percent) >= 10 ? percent.toFixed(0) : percent.toFixed(1)
  return `${percent >= 0 ? '+' : ''}${fixed}%`
}

function toneFromDelta(delta: number): SnapshotTone {
  if (delta >= 0.06) return 'success'
  if (delta <= -0.06) return 'warning'
  return 'neutral'
}

function labelFromHistoryDelta(delta: number): string {
  if (delta >= 0.06) return 'Above usual'
  if (delta <= -0.06) return 'Below usual'
  return 'On pace'
}

function labelFromRepeatDelta(delta: number): string {
  if (delta >= 0.04) return 'Warming up'
  if (delta <= -0.04) return 'Cooling off'
  return 'Steady'
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) {
    return sorted[middle]
  }

  return (sorted[middle - 1] + sorted[middle]) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
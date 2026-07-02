import type { RunPerformanceEvent, RunStatsEvent, RunStatsSummary } from '@/shared/types'
import type { ScenarioAnalysis } from './scenarioAnalysis'

export type EventsChartPoint = {
  timeSec: number
  killsOverTime: number
  accOverTime?: number
}

export type AnalysisChartData = {
  events: EventsChartPoint[]
  eventsDomainMax: number
  ttk: Array<Record<string, unknown>>
  scatter: Array<{ x: number; y: number }>
}

const SEC_IN_DAY = 86400
const TIME_PRECISION = 3

function round(value: number, digits: number): number {
  return +value.toFixed(digits)
}

function toClockSec(value: unknown): number {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/)
  if (!match) return Number.NaN

  return parseInt(match[1], 10) * 3600
    + parseInt(match[2], 10) * 60
    + parseInt(match[3], 10)
    + (match[4] ? parseFloat(`0.${match[4]}`) : 0)
}

// Seconds elapsed from origin to current, tolerating a midnight rollover.
function elapsedSec(currentSec: number, originSec: number): number {
  return currentSec >= originSec ? currentSec - originSec : currentSec + (SEC_IN_DAY - originSec)
}

function accuracyPercent(shots: number, hits: number): number {
  if (!Number.isFinite(shots) || shots <= 0 || !Number.isFinite(hits)) return 0
  return round(Math.min(1, Math.max(0, hits / shots)) * 100, 1)
}

type KillSample = { timeSec: number; killsOverTime: number; accOverTime: number }

type AccuracySample = { timeSec: number; accOverTime: number }

// Exact kill timeline from the legacy stats stream, with cumulative accuracy.
function buildKillSamples(statsEvents: RunStatsEvent[], originSec: number): KillSample[] {
  const samples: KillSample[] = []
  let cumulativeShots = 0
  let cumulativeHits = 0
  let killCount = 0

  for (const event of statsEvents) {
    const clockSec = toClockSec(event.timestamp)
    if (!Number.isFinite(clockSec)) continue

    killCount += 1
    if (Number.isFinite(event.shots)) cumulativeShots += event.shots
    if (Number.isFinite(event.hits)) cumulativeHits += event.hits

    samples.push({
      timeSec: round(elapsedSec(clockSec, originSec), TIME_PRECISION),
      killsOverTime: killCount,
      accOverTime: accuracyPercent(cumulativeShots, cumulativeHits),
    })
  }

  return samples
}

// Per-second cumulative accuracy from the v2 performance stream. Timestamps are
// already relative to the challenge start, so they need no offset adjustment.
function buildPerformanceAccuracy(performanceEvents: RunPerformanceEvent[]): AccuracySample[] {
  const buckets = new Map<number, { shots: number; hits: number }>()

  for (const event of performanceEvents) {
    if (!Number.isFinite(event.timestamp) || event.count === undefined || !Number.isFinite(event.count)) continue

    const key = round(event.timestamp, TIME_PRECISION)
    const bucket = buckets.get(key) ?? { shots: 0, hits: 0 }

    if (event.payloadType === 'shotsFired') bucket.shots += event.count
    else if (event.payloadType === 'shotsHit') bucket.hits += event.count
    else continue

    buckets.set(key, bucket)
  }

  let cumulativeShots = 0
  let cumulativeHits = 0
  const rows: AccuracySample[] = []

  for (const [timeSec, bucket] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    cumulativeShots += bucket.shots
    cumulativeHits += bucket.hits
    if (cumulativeShots <= 0) continue
    rows.push({ timeSec, accOverTime: accuracyPercent(cumulativeShots, cumulativeHits) })
  }

  return rows
}

function withBootstrapAccuracy(samples: AccuracySample[]): AccuracySample[] {
  if (samples.length === 0) return samples

  const first = samples[0]
  if (first.timeSec <= 0) return samples

  return [{ timeSec: 0, accOverTime: first.accOverTime }, ...samples]
}

function resolveDomainMax(lastTimeSec: number, timeLimitSec: number): number {
  if (!Number.isFinite(lastTimeSec) || lastTimeSec <= 0) {
    return Number.isFinite(timeLimitSec) && timeLimitSec > 0 ? round(timeLimitSec, TIME_PRECISION) : 0
  }

  if (!Number.isFinite(timeLimitSec) || timeLimitSec <= 0 || timeLimitSec <= lastTimeSec) {
    return round(lastTimeSec, TIME_PRECISION)
  }

  const gapSec = timeLimitSec - lastTimeSec
  const ratio = timeLimitSec / Math.max(lastTimeSec, 1)
  const looksPlausible = gapSec <= 5 || ratio <= 1.25

  return round(looksPlausible ? timeLimitSec : lastTimeSec, TIME_PRECISION)
}

function buildEventsTimeline(
  summary: RunStatsSummary,
  statsEvents: RunStatsEvent[],
  performanceEvents: RunPerformanceEvent[],
  timeLimitSec: number,
): { events: EventsChartPoint[]; domainMax: number } {
  if (statsEvents.length === 0) return { events: [], domainMax: 0 }

  const challengeStartSec = toClockSec(summary.challengeStart)
  const firstKillSec = toClockSec(statsEvents[0]?.timestamp)

  // Prefer the challenge start as the origin so the performance samples line up.
  // If it is missing (older v1 files) fall back to the first kill and skip the
  // performance stream, which we cannot align without the challenge start.
  const useChallengeOrigin = Number.isFinite(challengeStartSec)
  const originSec = useChallengeOrigin ? challengeStartSec : firstKillSec
  if (!Number.isFinite(originSec)) return { events: [], domainMax: 0 }

  const killSamples = buildKillSamples(statsEvents, originSec)
  if (killSamples.length === 0) return { events: [], domainMax: 0 }

  const performanceAccuracy = useChallengeOrigin ? withBootstrapAccuracy(buildPerformanceAccuracy(performanceEvents)) : []

  const byKey = new Map<string, EventsChartPoint>()
  const keyOf = (timeSec: number) => timeSec.toFixed(TIME_PRECISION)

  for (const sample of killSamples) {
    byKey.set(keyOf(sample.timeSec), {
      timeSec: sample.timeSec,
      killsOverTime: sample.killsOverTime,
      accOverTime: sample.accOverTime,
    })
  }

  const accuracySource = performanceAccuracy.length > 0
    ? performanceAccuracy
    : killSamples.map(sample => ({ timeSec: sample.timeSec, accOverTime: sample.accOverTime }))

  for (const sample of accuracySource) {
    const key = keyOf(sample.timeSec)
    const existing = byKey.get(key)
    if (existing) existing.accOverTime = sample.accOverTime
    else byKey.set(key, { timeSec: sample.timeSec, killsOverTime: Number.NaN, accOverTime: sample.accOverTime })
  }

  const events = Array.from(byKey.values()).sort((a, b) => a.timeSec - b.timeSec)

  // Forward-fill the cumulative kill count so the step line is defined at every
  // performance sample that falls between two kills.
  let runningKills = 0
  for (const point of events) {
    if (Number.isFinite(point.killsOverTime)) runningKills = point.killsOverTime
    else point.killsOverTime = runningKills
  }

  const lastTimeSec = events[events.length - 1]?.timeSec ?? 0
  const domainMax = resolveDomainMax(lastTimeSec, timeLimitSec)

  // Extend the final values to the run's end so the chart fills the full width.
  if (domainMax > lastTimeSec) {
    const last = events[events.length - 1]
    events.push({ timeSec: domainMax, killsOverTime: last.killsOverTime, accOverTime: last.accOverTime })
  }

  return { events, domainMax: domainMax > 0 ? domainMax : lastTimeSec }
}

export function buildAnalysisChartData(
  analysis: ScenarioAnalysis,
  summary: RunStatsSummary,
  statsEvents: RunStatsEvent[],
  performanceEvents: RunPerformanceEvent[],
  timeLimitSec = 0,
): AnalysisChartData {
  const { events, domainMax } = buildEventsTimeline(summary, statsEvents, performanceEvents, timeLimitSec)

  return {
    events,
    eventsDomainMax: domainMax,
    ttk: analysis.timeSec.map((timeSec, index) => ({
      timeSec: round(timeSec, TIME_PRECISION),
      realTTK: round(analysis.realTTK[index], 3),
      ma5: round(analysis.movingAvg.ma5[index], 3),
    })),
    scatter: analysis.kpm.map((kpm, index) => ({
      x: round(kpm, 1),
      y: round(analysis.perKillAcc[index] * 100, 1),
    })),
  }
}

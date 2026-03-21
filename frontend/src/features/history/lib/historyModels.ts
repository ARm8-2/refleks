import { getScenarioName, readScenarioAccuracy, readScenarioDurationMs, readScenarioScore, readScenarioTimestamp } from '@/shared/lib'
import type { ScenarioRecord, Session, StatKey } from '@/shared/types'

const sessionFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const compactDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const preciseNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

export type HistoryRun = {
  id: string
  sessionId: string
  session: Session
  item: ScenarioRecord
  scenarioName: string
  playedAt: number
  score: number
  accuracy: number | null
  durationMs: number
  orderInSession: number
}

export function buildHistoryRuns(sessions: Session[]): HistoryRun[] {
  return sessions.flatMap(session => session.items.map((item, index) => ({
    id: item.filePath || `${session.id}:${index}`,
    sessionId: session.id,
    session,
    item,
    scenarioName: getScenarioName(item).trim() || 'Unknown scenario',
    playedAt: readScenarioTimestamp(item),
    score: readScenarioScore(item),
    accuracy: readScenarioAccuracy(item),
    durationMs: readScenarioDurationMs(item),
    orderInSession: index,
  })))
}

export function readSessionStartTimestamp(session: Session): number {
  const start = Date.parse(session.start)
  if (Number.isFinite(start) && start > 0) return start

  const timestamps = session.items.map(readScenarioTimestamp).filter(timestamp => timestamp > 0)
  return timestamps.length > 0 ? Math.min(...timestamps) : 0
}

export function readSessionEndTimestamp(session: Session): number {
  const end = Date.parse(session.end)
  if (Number.isFinite(end) && end > 0) return end

  const timestamps = session.items.map(readScenarioTimestamp).filter(timestamp => timestamp > 0)
  return timestamps.length > 0 ? Math.max(...timestamps) : 0
}

export function readSessionDurationMs(session: Session): number {
  const start = readSessionStartTimestamp(session)
  const end = readSessionEndTimestamp(session)
  if (start > 0 && end >= start) return end - start
  return 0
}

export function readUniqueScenarioCount(session: Session): number {
  return new Set(session.items.map(item => getScenarioName(item).trim()).filter(Boolean)).size
}

export function readSessionActivePlaytimeMs(session: Session): number {
  return session.items.reduce((sum, item) => sum + readScenarioDurationMs(item), 0)
}

export function readSessionAverageScore(session: Session): number {
  const scores = session.items.map(readScenarioScore).filter(score => score > 0)
  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

export function readTopRepeatedScenario(session: Session): { name: string; attempts: number } | null {
  const counts = new Map<string, number>()

  for (const item of session.items) {
    const name = getScenarioName(item).trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  let result: { name: string; attempts: number } | null = null
  for (const [name, attempts] of counts) {
    if (!result || attempts > result.attempts) {
      result = { name, attempts }
    }
  }

  return result
}

export type ScenarioSummary = {
  name: string
  count: number
  bestScore: number
  trend: 'up' | 'down' | 'same' | null
}

export function buildSessionScenarioSummaries(session: Session, sessions: Session[]): ScenarioSummary[] {
  const grouped = new Map<string, ScenarioRecord[]>()
  for (const item of session.items) {
    const name = getScenarioName(item).trim()
    if (!name) continue
    const list = grouped.get(name) ?? []
    list.push(item)
    grouped.set(name, list)
  }

  // Find previous session for trend comparison
  const sessionIndex = sessions.findIndex(s => s.id === session.id)
  const prevSession = sessionIndex >= 0 && sessionIndex < sessions.length - 1 ? sessions[sessionIndex + 1] : null
  const prevBestMap = new Map<string, number>()
  if (prevSession) {
    for (const item of prevSession.items) {
      const name = getScenarioName(item).trim()
      if (!name) continue
      const score = readScenarioScore(item)
      const current = prevBestMap.get(name) ?? 0
      if (score > current) prevBestMap.set(name, score)
    }
  }

  const summaries: ScenarioSummary[] = []
  for (const [name, items] of grouped) {
    const bestScore = Math.max(...items.map(readScenarioScore))
    const prevBest = prevBestMap.get(name)
    let trend: 'up' | 'down' | 'same' | null = null
    if (prevBest != null && bestScore > 0) {
      if (bestScore > prevBest) trend = 'up'
      else if (bestScore < prevBest) trend = 'down'
      else trend = 'same'
    }
    summaries.push({ name, count: items.length, bestScore, trend })
  }

  summaries.sort((a, b) => b.count - a.count)
  return summaries
}

export type ScenarioTrendPoint = {
  label: string
  fullLabel: string
  score: number
  accuracy: number | null
  runId: string
}

export function buildSessionScenarioTrendPoints(
  scenarioName: string,
  runs: HistoryRun[],
): ScenarioTrendPoint[] {
  const scenarioRuns = runs
    .filter(run => run.scenarioName === scenarioName)
    .slice()
    .reverse()

  return scenarioRuns
    .map((run, i) => ({
      label: run.playedAt > 0 ? compactDateFormatter.format(run.playedAt) : `#${i + 1}`,
      fullLabel: run.playedAt > 0 ? sessionFormatter.format(run.playedAt) : `Attempt #${i + 1}`,
      score: run.score,
      accuracy: run.accuracy,
      runId: run.id,
    }))
}

export function formatSessionTitle(session: Session): string {
  const customName = session.name?.trim()
  if (customName) return customName

  const startedAt = readSessionStartTimestamp(session)
  return startedAt > 0 ? sessionFormatter.format(startedAt) : 'Untitled session'
}

export function formatSessionDateRange(session: Session): string {
  const start = readSessionStartTimestamp(session)
  const end = readSessionEndTimestamp(session)

  if (start <= 0 && end <= 0) return 'No timing data'
  if (start <= 0 || end <= 0) return sessionFormatter.format(Math.max(start, end))

  const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
  if (sameDay) {
    return `${sessionFormatter.format(start)} to ${timeFormatter.format(end)}`
  }

  return `${sessionFormatter.format(start)} to ${sessionFormatter.format(end)}`
}

export function formatCompactDate(timestamp: number): string {
  return timestamp > 0 ? compactDateFormatter.format(timestamp) : '--'
}

export function formatRunTimestamp(timestamp: number): string {
  return timestamp > 0 ? sessionFormatter.format(timestamp) : 'No timestamp'
}

export function formatRelativeTime(timestamp: number): string {
  if (timestamp <= 0) return '--'

  const diff = timestamp - Date.now()
  const abs = Math.abs(diff)

  if (abs < 60_000) return 'just now'
  if (abs < 3_600_000) {
    const minutes = Math.round(abs / 60_000)
    return `${minutes}m ago`
  }
  if (abs < 86_400_000) {
    const hours = Math.round(abs / 3_600_000)
    return `${hours}h ago`
  }
  if (abs < 604_800_000) {
    const days = Math.round(abs / 86_400_000)
    return `${days}d ago`
  }

  const weeks = Math.round(abs / 604_800_000)
  return `${weeks}w ago`
}

export function formatDurationLabel(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '--'

  const totalSeconds = Math.round(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return numberFormatter.format(value)
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '--'

  if (decimals <= 0) {
    return numberFormatter.format(value)
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${preciseNumberFormatter.format(value)}%`
}

export function matchSessionSearch(session: Session, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const title = formatSessionTitle(session).toLowerCase()
  if (title.includes(normalized)) return true

  const range = formatSessionDateRange(session).toLowerCase()
  if (range.includes(normalized)) return true

  return session.items.some(item => getScenarioName(item).toLowerCase().includes(normalized))
}

export function matchRunSearch(run: HistoryRun, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return run.scenarioName.toLowerCase().includes(normalized)
    || run.item.fileName.toLowerCase().includes(normalized)
    || formatRunTimestamp(run.playedAt).toLowerCase().includes(normalized)
}

export function buildRunStats(item: ScenarioRecord): Array<{ label: string; value: string }> {
  const stats = item.stats ?? {}
  const entries: Array<{ label: string; value: string }> = []
  const seen = new Set<string>()
  const priorityKeys: StatKey[] = [
    'Score',
    'Accuracy',
    'Duration',
    'Kills',
    'Damage Done',
    'Hit Count',
    'Avg TTK',
  ]

  const pushEntry = (key: string) => {
    if (seen.has(key) || !(key in stats)) return

    const raw = stats[key]
    let value = '--'

    if (key === 'Accuracy') {
      value = formatPercent(readScenarioAccuracy(item))
    } else if (key === 'Duration') {
      value = formatDurationLabel(readScenarioDurationMs(item))
    } else if (typeof raw === 'number') {
      value = formatNumber(raw, Number.isInteger(raw) ? 0 : 2)
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed) value = trimmed
    }

    if (value !== '--') {
      entries.push({ label: key, value })
      seen.add(key)
    }
  }

  for (const key of priorityKeys) {
    pushEntry(key)
  }

  for (const key of Object.keys(stats)) {
    pushEntry(key)
  }

  return entries
}

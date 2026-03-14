import { useMemo } from 'react'
import { useStore } from '../../../shared/hooks'
import { getScenarioName } from '../../benchmarks/lib/detailFormatting'

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export type TrendPoint = {
  label: string
  fullLabel: string
  score: number
}

type CurrentScenarioHistory = {
  currentScenarioName: string | null
  sessionAveragePoints: TrendPoint[]
  attemptPoints: TrendPoint[]
}

export function useCurrentScenarioHistory(): CurrentScenarioHistory {
  const sessions = useStore(state => state.sessions)

  return useMemo(() => {
    let currentScenarioName: string | null = null

    for (const session of sessions) {
      for (const item of session.items) {
        const name = getScenarioName(item).trim()
        if (name) {
          currentScenarioName = name
          break
        }
      }

      if (currentScenarioName) break
    }

    if (!currentScenarioName) {
      return {
        currentScenarioName: null,
        sessionAveragePoints: [],
        attemptPoints: [],
      }
    }

    const sessionAveragePoints: TrendPoint[] = []
    const attemptPoints: TrendPoint[] = []
    const orderedSessions = [...sessions].reverse()

    for (const session of orderedSessions) {
      const matchingItems = [...session.items]
        .reverse()
        .filter(item => getScenarioName(item).trim() === currentScenarioName)

      if (matchingItems.length === 0) continue

      const scores = matchingItems.map(readScenarioScore)
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
      const sessionTs = Math.max(...matchingItems.map(readScenarioTimestamp))
      const shortLabel = formatShortDate(sessionTs, sessionAveragePoints.length + 1)
      const fullLabel = formatSessionLabel(session.start, session.end, scores.length)

      sessionAveragePoints.push({
        label: shortLabel,
        fullLabel,
        score: Number(averageScore.toFixed(1)),
      })

      for (const item of matchingItems) {
        const score = readScenarioScore(item)
        const timestamp = readScenarioTimestamp(item)
        const nextIndex = attemptPoints.length + 1

        attemptPoints.push({
          label: String(nextIndex),
          fullLabel: formatAttemptLabel(timestamp, nextIndex),
          score,
        })
      }
    }

    return {
      currentScenarioName,
      sessionAveragePoints,
      attemptPoints,
    }
  }, [sessions])
}

function readScenarioScore(item: { stats?: Record<string, unknown> }): number {
  const score = Number(item.stats?.['Score'] ?? 0)
  return Number.isFinite(score) ? score : 0
}

function readScenarioTimestamp(item: { stats?: Record<string, unknown> }): number {
  const raw = item.stats?.['Date Played']
  if (!raw) return 0

  const timestamp = Date.parse(String(raw))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatShortDate(timestamp: number, fallbackIndex: number): string {
  if (timestamp <= 0) return `S${fallbackIndex}`
  return shortDateFormatter.format(new Date(timestamp))
}

function formatAttemptLabel(timestamp: number, attemptIndex: number): string {
  if (timestamp <= 0) return `Attempt ${attemptIndex}`
  return `Attempt ${attemptIndex} · ${dateTimeFormatter.format(new Date(timestamp))}`
}

function formatSessionLabel(start: string, end: string, attempts: number): string {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${attempts} ${attempts === 1 ? 'run' : 'runs'}`
  }

  return `${dateTimeFormatter.format(startDate)} to ${dateTimeFormatter.format(endDate)} · ${attempts} ${attempts === 1 ? 'run' : 'runs'}`
}
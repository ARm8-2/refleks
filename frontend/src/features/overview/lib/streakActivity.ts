import type { Session } from '@/shared/types'

export type DailyPlaytime = {
  dayTs: number
  playtimeMs: number
}

export type StreakSpan = {
  startTs: number
  endTs: number
  days: number
}

export type StreakActivitySummary = {
  currentStreak: number
  topStreak: number
  todayPlaytimeMs: number
  totalPlaytimeMs: number
  activeDays: number
  lastActiveDayTs: number | null
  dailyPlaytime: DailyPlaytime[]
  streakSpans: StreakSpan[]
}

export type ActivityRangeCell = {
  dayTs: number
  playtimeMs: number
}

export type ActivityRangeSummary = {
  cells: ActivityRangeCell[]
  totalPlaytimeMs: number
  activeDays: number
  longestStreak: number
}

export type HourlyActivityPoint = {
  hour: number
  playtimeMs: number
}

export type WeeklyActivityPoint = {
  dayTs: number
  playtimeMs: number
}

export function buildStreakActivity(sessions: Session[], now = new Date()): StreakActivitySummary {
  const dayPlaytime = new Map<number, number>()
  let totalPlaytimeMs = 0

  for (const session of sessions) {
    for (const item of session.items) {
      const ts = readRunTimestamp(item.stats)
      if (ts <= 0) continue

      const dayTs = startOfDayTs(new Date(ts))
      const runDurationMs = readRunDurationMs(item.stats)
      if (runDurationMs <= 0) continue

      totalPlaytimeMs += runDurationMs
      dayPlaytime.set(dayTs, (dayPlaytime.get(dayTs) ?? 0) + runDurationMs)
    }
  }

  const sortedDays = [...dayPlaytime.keys()].sort((left, right) => left - right)
  const todayTs = startOfDayTs(now)
  const todayPlaytimeMs = dayPlaytime.get(todayTs) ?? 0

  let currentStreak = 0
  let cursorTs = todayTs
  while (dayPlaytime.has(cursorTs)) {
    currentStreak += 1
    cursorTs = previousDayTs(cursorTs)
  }

  const streakSpans = buildStreakSpans(sortedDays)
  const topStreak = streakSpans.length > 0 ? Math.max(...streakSpans.map(span => span.days)) : 0
  const lastActiveDayTs = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null

  const dailyPlaytime: DailyPlaytime[] = sortedDays.map(dayTs => ({
    dayTs,
    playtimeMs: dayPlaytime.get(dayTs) ?? 0,
  }))

  return {
    currentStreak,
    topStreak,
    todayPlaytimeMs,
    totalPlaytimeMs,
    activeDays: dayPlaytime.size,
    lastActiveDayTs,
    dailyPlaytime,
    streakSpans,
  }
}

export function buildActivityRange(activity: StreakActivitySummary, days: number, now = new Date()): ActivityRangeSummary {
  const safeDays = Math.max(1, Math.floor(days))
  const end = startOfDay(now)
  const start = startOfDay(now)
  start.setDate(start.getDate() - (safeDays - 1))

  const playtimeByDay = new Map(activity.dailyPlaytime.map(point => [point.dayTs, point.playtimeMs]))
  const activeDaySet = new Set<number>()
  const cells: ActivityRangeCell[] = []
  let totalPlaytimeMs = 0

  for (const cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
    const dayTs = cursor.getTime()
    const playtimeMs = playtimeByDay.get(dayTs) ?? 0
    if (playtimeMs > 0) {
      activeDaySet.add(dayTs)
      totalPlaytimeMs += playtimeMs
    }
    cells.push({ dayTs, playtimeMs })
  }

  let longestStreak = 0
  let streak = 0
  for (const cell of cells) {
    if (activeDaySet.has(cell.dayTs)) {
      streak += 1
      if (streak > longestStreak) longestStreak = streak
    } else {
      streak = 0
    }
  }

  return {
    cells,
    totalPlaytimeMs,
    activeDays: activeDaySet.size,
    longestStreak,
  }
}

export function buildHourlyActivityForDay(sessions: Session[], dayTs: number): HourlyActivityPoint[] {
  const normalizedDayTs = startOfDayTs(new Date(dayTs))
  const hourlyMs = Array.from({ length: 24 }, () => 0)

  for (const session of sessions) {
    for (const item of session.items) {
      const ts = readRunTimestamp(item.stats)
      if (ts <= 0 || startOfDayTs(new Date(ts)) !== normalizedDayTs) continue

      const durationMs = readRunDurationMs(item.stats)
      if (durationMs <= 0) continue

      const hour = new Date(ts).getHours()
      hourlyMs[hour] += durationMs
    }
  }

  return hourlyMs.map((playtimeMs, hour) => ({ hour, playtimeMs }))
}

export function buildDailyActivityForWeek(activity: StreakActivitySummary, dayTs: number): WeeklyActivityPoint[] {
  const weekStartTs = startOfWeekTs(dayTs)
  const playtimeByDay = new Map(activity.dailyPlaytime.map(point => [point.dayTs, point.playtimeMs]))

  return Array.from({ length: 7 }, (_, offset) => {
    const currentDayTs = addDaysTs(weekStartTs, offset)
    return {
      dayTs: currentDayTs,
      playtimeMs: playtimeByDay.get(currentDayTs) ?? 0,
    }
  })
}

export function buildDailyActivityForSelectedStreak(activity: StreakActivitySummary, dayTs: number): WeeklyActivityPoint[] {
  const selectedDayTs = startOfDayTs(new Date(dayTs))
  const span = activity.streakSpans.find(item => selectedDayTs >= item.startTs && selectedDayTs <= item.endTs)
  if (!span) return []

  const playtimeByDay = new Map(activity.dailyPlaytime.map(point => [point.dayTs, point.playtimeMs]))
  const points: WeeklyActivityPoint[] = []

  for (let cursor = span.startTs; cursor <= span.endTs; cursor = nextDayTs(cursor)) {
    points.push({
      dayTs: cursor,
      playtimeMs: playtimeByDay.get(cursor) ?? 0,
    })
  }

  return points
}

function buildStreakSpans(sortedDays: number[]): StreakSpan[] {
  if (sortedDays.length === 0) return []

  const spans: StreakSpan[] = []
  let streakStart = sortedDays[0]
  let streakEnd = sortedDays[0]
  let streakDays = 1

  for (let index = 1; index < sortedDays.length; index += 1) {
    const dayTs = sortedDays[index]
    const expectedNext = nextDayTs(streakEnd)
    if (dayTs === expectedNext) {
      streakEnd = dayTs
      streakDays += 1
      continue
    }

    spans.push({
      startTs: streakStart,
      endTs: streakEnd,
      days: streakDays,
    })

    streakStart = dayTs
    streakEnd = dayTs
    streakDays = 1
  }

  spans.push({
    startTs: streakStart,
    endTs: streakEnd,
    days: streakDays,
  })

  return spans
}

function readRunTimestamp(stats: Record<string, unknown> | undefined): number {
  const raw = stats?.['Date Played']
  if (!raw) return 0

  const timestamp = Date.parse(String(raw))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function readRunDurationMs(stats: Record<string, unknown> | undefined): number {
  const seconds = Number(stats?.['Duration'] ?? 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return seconds * 1000
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfDayTs(date: Date): number {
  return startOfDay(date).getTime()
}

function previousDayTs(dayTs: number): number {
  const date = new Date(dayTs)
  date.setDate(date.getDate() - 1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function nextDayTs(dayTs: number): number {
  const date = new Date(dayTs)
  date.setDate(date.getDate() + 1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function addDaysTs(dayTs: number, days: number): number {
  const date = new Date(dayTs)
  date.setDate(date.getDate() + days)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function startOfWeekTs(dayTs: number): number {
  const date = new Date(dayTs)
  date.setDate(date.getDate() - date.getDay())
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

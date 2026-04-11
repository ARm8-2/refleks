import { SegmentedControl, Widget, WidgetEmpty } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { usePersistedState, useStore } from '@/shared/hooks'
import { CHART_SERIES_COLORS, CHART_STYLE, STORAGE_KEYS } from '@/shared/lib'
import { Flame, Trophy } from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useDailyPlaytime } from '../../hooks/useDailyPlaytime'
import type { RecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { buildActivityRange, buildDailyActivityForSelectedStreak, buildDailyActivityForWeek, buildHourlyActivityForDay, buildStreakActivity } from '../../lib/streakActivity'

const playtimeConfig: ChartConfig = {
  minutes: { label: 'Playtime', color: CHART_SERIES_COLORS.accuracy },
}

const drilldownConfig: ChartConfig = {
  minutes: { label: 'Playtime', color: 'var(--streak)' },
}

const AUTO_RANGE_DAYS = 0
const STREAK_RANGE_OPTIONS = [AUTO_RANGE_DAYS, 30, 90, 180, 365] as const
const BREAKDOWN_MODES = ['day', 'week', 'streak'] as const

type StreakRangeOption = (typeof STREAK_RANGE_OPTIONS)[number]
type BreakdownMode = (typeof BREAKDOWN_MODES)[number]

const weekdayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })

type MonthMarker = {
  label: string
  column: number
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const streakDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

const intensityOpacityByLevel: Record<1 | 2 | 3 | 4, number> = {
  1: 0.2,
  2: 0.38,
  3: 0.56,
  4: 0.78,
}

export function StreakPlaytimeWidget({ snapshot }: { snapshot: RecentSessionSnapshot }) {
  const points = useDailyPlaytime(7)
  const sessions = useStore(state => state.sessions)
  const [storedRangeDays, setStoredRangeDays] = usePersistedState<number>(STORAGE_KEYS.overviewStreakRangeDays, AUTO_RANGE_DAYS)
  const [storedSelectedDayTs, setStoredSelectedDayTs] = usePersistedState<number | null>(STORAGE_KEYS.overviewStreakSelectedDayTs, null)
  const [storedBreakdownMode, setStoredBreakdownMode] = usePersistedState<BreakdownMode>(STORAGE_KEYS.overviewStreakBreakdownMode, 'day')

  const selectedDayTs = normalizeSelectedDayTs(storedSelectedDayTs)
  const breakdownMode = normalizeBreakdownMode(storedBreakdownMode)

  const hasData = points.some(p => p.minutes > 0)
  const chartData = hasData ? points : points.map(p => ({ ...p, minutes: 0.5 }))
  const rangeDays = normalizeRangeDays(storedRangeDays)

  const streakActivity = useMemo(() => buildStreakActivity(sessions), [sessions])
  const maxAvailableRangeDays = useMemo(() => {
    const earliestDayTs = streakActivity.dailyPlaytime[0]?.dayTs
    if (typeof earliestDayTs !== 'number') return 30
    return Math.max(1, daysBetweenInclusive(earliestDayTs, Date.now()))
  }, [streakActivity.dailyPlaytime])
  const effectiveRangeDays = rangeDays === AUTO_RANGE_DAYS ? maxAvailableRangeDays : rangeDays

  const rangeSummary = useMemo(
    () => buildActivityRange(streakActivity, effectiveRangeDays),
    [effectiveRangeDays, streakActivity],
  )

  const heatmapCells = useMemo(() => {
    if (rangeSummary.cells.length === 0) return [] as Array<{ dayTs: number; playtimeMs: number; level: 0 | 1 | 2 | 3 | 4 }>

    const values = rangeSummary.cells
      .map(cell => cell.playtimeMs / 60000)
      .filter(value => value > 0)
      .sort((left, right) => left - right)

    const q1 = quantile(values, 0.25)
    const q2 = quantile(values, 0.5)
    const q3 = quantile(values, 0.75)

    return rangeSummary.cells.map(cell => {
      const minutes = cell.playtimeMs / 60000

      let level: 0 | 1 | 2 | 3 | 4 = 0
      if (minutes > 0) {
        if (minutes <= q1) level = 1
        else if (minutes <= q2) level = 2
        else if (minutes <= q3) level = 3
        else level = 4
      }

      return {
        dayTs: cell.dayTs,
        playtimeMs: cell.playtimeMs,
        level,
      }
    })
  }, [rangeSummary.cells])

  const paddedHeatmapCells = useMemo(() => {
    if (heatmapCells.length === 0) return [] as Array<{ dayTs: number; playtimeMs: number; level: 0 | 1 | 2 | 3 | 4 } | null>

    const firstDate = new Date(heatmapCells[0].dayTs)
    const leadingPad = firstDate.getDay()
    const trailingPad = (7 - ((leadingPad + heatmapCells.length) % 7)) % 7

    return [
      ...Array.from({ length: leadingPad }, () => null),
      ...heatmapCells,
      ...Array.from({ length: trailingPad }, () => null),
    ]
  }, [heatmapCells])

  const monthMarkers = useMemo<MonthMarker[]>(() => {
    const markers: MonthMarker[] = []
    let lastMonthKey = ''

    paddedHeatmapCells.forEach((cell, index) => {
      if (!cell) return

      const date = new Date(cell.dayTs)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      if (monthKey === lastMonthKey) return

      lastMonthKey = monthKey
      markers.push({
        label: monthFormatter.format(date),
        column: Math.floor(index / 7),
      })
    })

    return markers
  }, [paddedHeatmapCells])

  const visibleMonthMarkers = useMemo(
    () => monthMarkers.filter((marker, index) => !(monthMarkers.length > 1 && index === 0 && marker.column === 0)),
    [monthMarkers],
  )

  const streakLengthByDayTs = useMemo(() => {
    const map = new Map<number, number>()

    for (const span of streakActivity.streakSpans) {
      for (let cursor = span.startTs; cursor <= span.endTs;) {
        map.set(cursor, span.days)

        const nextCursor = new Date(cursor)
        nextCursor.setDate(nextCursor.getDate() + 1)
        nextCursor.setHours(0, 0, 0, 0)
        cursor = nextCursor.getTime()
      }
    }

    return map
  }, [streakActivity.streakSpans])

  const topStreakDayTs = useMemo(() => {
    const targetDays = streakActivity.topStreak
    if (targetDays <= 0) return null

    let mostRecentTopDay: number | null = null
    for (const span of streakActivity.streakSpans) {
      if (span.days !== targetDays) continue
      if (mostRecentTopDay === null || span.endTs > mostRecentTopDay) {
        mostRecentTopDay = span.endTs
      }
    }

    return mostRecentTopDay
  }, [streakActivity.streakSpans, streakActivity.topStreak])

  useEffect(() => {
    if (selectedDayTs === null) return
    const stillVisible = heatmapCells.some(cell => cell.dayTs === selectedDayTs)
    if (!stillVisible) setStoredSelectedDayTs(null)
  }, [heatmapCells, selectedDayTs, setStoredSelectedDayTs])

  const dailyBreakdown = useMemo(
    () => selectedDayTs === null
      ? []
      : buildHourlyActivityForDay(sessions, selectedDayTs).map(point => ({
        key: `${point.hour}`,
        label: `${String(point.hour).padStart(2, '0')}:00`,
        fullLabel: hourRangeLabel(point.hour),
        minutes: point.playtimeMs / 60000,
      })),
    [selectedDayTs, sessions],
  )

  const weeklyBreakdown = useMemo(
    () => selectedDayTs === null
      ? []
      : buildDailyActivityForWeek(streakActivity, selectedDayTs).map(point => ({
        key: `${point.dayTs}`,
        label: weekTickFormatter(new Date(point.dayTs)),
        fullLabel: dayFormatter.format(new Date(point.dayTs)),
        minutes: point.playtimeMs / 60000,
      })),
    [selectedDayTs, streakActivity],
  )

  const streakBreakdown = useMemo(
    () => selectedDayTs === null
      ? []
      : buildDailyActivityForSelectedStreak(streakActivity, selectedDayTs).map(point => ({
        key: `${point.dayTs}`,
        label: streakTickFormatter(new Date(point.dayTs)),
        fullLabel: dayFormatter.format(new Date(point.dayTs)),
        minutes: point.playtimeMs / 60000,
      })),
    [selectedDayTs, streakActivity],
  )

  const selectedBreakdown = breakdownMode === 'day'
    ? dailyBreakdown
    : breakdownMode === 'week'
      ? weeklyBreakdown
      : streakBreakdown
  const hasSelectedBreakdown = selectedDayTs !== null
  const selectedBreakdownLabel = selectedDayTs === null ? '' : dayFormatter.format(new Date(selectedDayTs))

  const selectActivityDay = (dayTs: number) => {
    const normalizedDayTs = normalizeSelectedDayTs(dayTs)
    if (normalizedDayTs === null) return

    if (selectedDayTs === normalizedDayTs) {
      setStoredSelectedDayTs(null)
      return
    }

    const requiredRangeDays = daysBetweenInclusive(normalizedDayTs, Date.now())
    const nextRangeDays = pickRangeDays(requiredRangeDays)
    if (rangeDays !== AUTO_RANGE_DAYS && nextRangeDays > effectiveRangeDays) setStoredRangeDays(nextRangeDays)

    setStoredSelectedDayTs(normalizedDayTs)
  }

  if (!snapshot.currentSession) return <WidgetEmpty icon={Flame} label="Streak & Playtime" />

  const { streakLabel, streakDetail } = snapshot

  const modalControls = (
    <SegmentedControl
      value={rangeDays}
      options={STREAK_RANGE_OPTIONS.map(days => ({
        value: days,
        label: days === AUTO_RANGE_DAYS ? 'All' : days === 365 ? '1Y' : `${Math.round(days / 30)}M`,
      }))}
      onValueChange={setStoredRangeDays}
      size="sm"
    />
  )

  const modalContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Current streak" value={`${streakActivity.currentStreak} ${pluralize('day', streakActivity.currentStreak)}`} />
        <MetricCard
          label="Top streak"
          value={`${snapshot.topStreak} ${pluralize('day', snapshot.topStreak)}`}
          icon={<Trophy className="h-3 w-3 text-amber-500" />}
          onClick={topStreakDayTs === null ? undefined : () => selectActivityDay(topStreakDayTs)}
          selected={topStreakDayTs !== null && selectedDayTs === topStreakDayTs}
        />
        <MetricCard label="Active days" value={`${rangeSummary.activeDays}/${effectiveRangeDays}`} />
        <MetricCard label="Total playtime" value={formatDuration(rangeSummary.totalPlaytimeMs)} />
      </div>

      <div className="rounded-xl bg-surface-subtle p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-surface-muted-foreground">Activity</p>
          <div className="flex items-center gap-1 text-[11px] text-surface-muted-foreground">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map(level => (
              <span key={level} className="h-2.5 w-2.5 rounded-[3px]" style={activityCellStyle(level as 0 | 1 | 2 | 3 | 4)} />
            ))}
            <span>More</span>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto pb-1">
          <div className="min-w-max">
            {visibleMonthMarkers.length > 0 && (
              <div className="mb-2 flex gap-2 text-[11px] font-medium text-surface-muted-foreground">
                <div className="w-5" aria-hidden="true" />
                <div
                  className="grid min-w-max"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(paddedHeatmapCells.length / 7))}, 14px)`,
                    columnGap: '6px',
                  }}
                >
                  {visibleMonthMarkers.map(marker => (
                    <span
                      key={`${marker.label}-${marker.column}`}
                      className="whitespace-nowrap"
                      style={{ gridColumnStart: marker.column + 1 }}
                    >
                      {marker.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="grid grid-rows-7 gap-1.5 pt-[2px] text-[11px] text-surface-muted-foreground">
                {weekdayLabels.map((label, index) => (
                  <span key={`${label}-${index}`} className="h-4 leading-4">{label}</span>
                ))}
              </div>

              <div className="p-1">
                <TooltipProvider delayDuration={100}>
                  <div className="grid grid-flow-col auto-cols-[14px] grid-rows-7 gap-1.5">
                    {paddedHeatmapCells.map((cell, index) => {
                      if (!cell) {
                        return <span key={`blank-${index}`} className="h-4 w-4" aria-hidden="true" />
                      }

                      const selected = selectedDayTs === cell.dayTs
                      const streakLength = streakLengthByDayTs.get(cell.dayTs) ?? 0
                      const streakLabel = streakLength > 0 ? `${streakLength} ${pluralize('day', streakLength)}` : 'No streak'

                      return (
                        <Tooltip key={cell.dayTs}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`h-4 w-4 rounded-[3px] border border-border-subtle transition-[transform,box-shadow,border-color,background-color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.96] hover:scale-110 hover:border-foreground/40 hover:shadow-sm focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${selected ? 'scale-110 border-[color:var(--primary-border-strong)] ring-2 ring-[color:var(--primary-emphasis)] shadow-sm' : ''}`}
                              style={selected ? selectedActivityCellStyle(cell.level) : activityCellStyle(cell.level)}
                              aria-label={`${dayFormatter.format(new Date(cell.dayTs))}: ${formatDuration(cell.playtimeMs)} playtime, ${streakLabel}`}
                              aria-pressed={selected}
                              onClick={() => {
                                selectActivityDay(cell.dayTs)
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[14rem]">
                            <div className="space-y-1">
                              <div className="font-medium text-popover-foreground">
                                {dayFormatter.format(new Date(cell.dayTs))}
                              </div>
                              <div className="text-popover-foreground/75">
                                Playtime: <span className="font-medium text-popover-foreground">{formatDuration(cell.playtimeMs)}</span>
                              </div>
                              <div className="text-popover-foreground/75">
                                Streak: <span className="font-medium text-popover-foreground">{streakLabel}</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border-subtle pt-4">
          <div
            className={`overflow-hidden transition-[max-height,opacity,transform] duration-220 ease-emphasized ${hasSelectedBreakdown ? 'max-h-[360px] translate-y-0 opacity-100' : 'pointer-events-none max-h-0 -translate-y-1 opacity-0'}`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-surface-muted-foreground">{selectedBreakdownLabel}</p>
              <SegmentedControl
                value={breakdownMode}
                options={BREAKDOWN_MODES.map(mode => ({
                  value: mode,
                  label: mode === 'day'
                    ? 'By Hour'
                    : mode === 'week'
                      ? 'By Weekday'
                      : 'Streak Days',
                }))}
                onValueChange={setStoredBreakdownMode}
                size="sm"
              />
            </div>

            <ChartContainer config={drilldownConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={selectedBreakdown} margin={{ top: 6, right: 8, left: 2, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={breakdownMode === 'day' ? 18 : breakdownMode === 'week' ? 8 : 16}
                  interval={breakdownMode === 'day' ? 2 : 'preserveStartEnd'}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={formatMinutesAxisTick}
                />
                <ChartTooltip
                  content={(
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? null}
                      formatter={(value) => [`${formatDuration(Number(value) * 60000)}`, 'Playtime']}
                    />
                  )}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="minutes"
                  fill="var(--color-minutes)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>

          <div
            className={`overflow-hidden transition-[max-height,opacity,transform] duration-220 ease-emphasized ${hasSelectedBreakdown ? 'pointer-events-none max-h-0 -translate-y-1 opacity-0' : 'max-h-[120px] translate-y-0 opacity-100'}`}
          >
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">Click a day above to inspect its playtime breakdown.</p>
              <p className="mt-1 text-xs text-surface-muted-foreground">You can switch between hour, weekday, and streak-day views after selecting a day.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Widget
      icon={Flame}
      iconClassName="text-[color:var(--streak)]"
      title="Streak & Playtime"
      modalTitle="Streak & Playtime Breakdown"
      modalControls={modalControls}
      modalContent={modalContent}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-[color:var(--streak)]">{streakLabel}</span>
        <span className="text-xs text-surface-muted-foreground">{streakDetail}</span>
      </div>
      <ChartContainer config={playtimeConfig} className="mt-1 aspect-auto h-[20px] w-full">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="streakPlaytimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-minutes)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-minutes)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="minutes"
            stroke="var(--color-minutes)"
            fill="url(#streakPlaytimeFill)"
            strokeWidth={CHART_STYLE.linePrimaryWidth}
          />
        </AreaChart>
      </ChartContainer>
    </Widget>
  )
}

function normalizeRangeDays(value: number): StreakRangeOption {
  return STREAK_RANGE_OPTIONS.includes(value as StreakRangeOption)
    ? value as StreakRangeOption
    : AUTO_RANGE_DAYS
}

function normalizeBreakdownMode(value: BreakdownMode): BreakdownMode {
  return BREAKDOWN_MODES.includes(value)
    ? value
    : 'day'
}

function normalizeSelectedDayTs(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function daysBetweenInclusive(fromTs: number, toTs: number): number {
  const start = normalizeSelectedDayTs(fromTs)
  const end = normalizeSelectedDayTs(toTs)
  if (start === null || end === null) return 1
  const diff = Math.abs(end - start)
  return Math.floor(diff / 86400000) + 1
}

function pickRangeDays(requiredDays: number): StreakRangeOption {
  const safeDays = Math.max(1, Math.floor(requiredDays))
  for (const candidate of STREAK_RANGE_OPTIONS) {
    if (candidate >= safeDays) return candidate
  }
  return STREAK_RANGE_OPTIONS[STREAK_RANGE_OPTIONS.length - 1]
}

function quantile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  const p = Math.min(1, Math.max(0, percentile))
  const index = (sortedValues.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedValues[lower]
  const ratio = index - lower
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * ratio
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'

  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes}m`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatMinutesAxisTick(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0m'
  if (value < 60) return `${Math.round(value)}m`

  const hours = value / 60
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`
}

function hourRangeLabel(hour: number): string {
  const startHour = hour % 24
  const endHour = (hour + 1) % 24
  return `${String(startHour).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00`
}

function weekTickFormatter(date: Date): string {
  return weekdayFormatter.format(date)
}

function streakTickFormatter(date: Date): string {
  return streakDayFormatter.format(date)
}

function activityCellStyle(level: 0 | 1 | 2 | 3 | 4) {
  if (level === 0) {
    return { backgroundColor: 'var(--surface-subtle)' }
  }

  return {
    backgroundColor: 'var(--streak)',
    opacity: intensityOpacityByLevel[level],
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--streak) 40%, transparent)',
  }
}

function selectedActivityCellStyle(level: 0 | 1 | 2 | 3 | 4) {
  if (level === 0) {
    return {
      backgroundColor: 'var(--primary-soft)',
      opacity: 1,
      boxShadow: 'inset 0 0 0 1px var(--primary-border-strong), 0 0 0 1px var(--primary), 0 0 10px var(--primary-soft)',
    }
  }

  return {
    backgroundColor: 'var(--primary)',
    opacity: Math.min(1, intensityOpacityByLevel[level] + 0.2),
    boxShadow: 'inset 0 0 0 1px var(--primary-border-strong), 0 0 0 1px var(--primary), 0 0 10px var(--primary-soft)',
  }
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`
}

function MetricCard({
  label,
  value,
  icon,
  onClick,
  selected = false,
}: {
  label: string
  value: string
  icon?: ReactNode
  onClick?: () => void
  selected?: boolean
}) {
  const className = `rounded-xl bg-surface-subtle px-3 py-2.5 text-left transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform ${onClick ? 'active:scale-[0.985] hover:bg-surface-emphasis focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring' : ''} ${selected ? 'bg-surface-emphasis shadow-sm' : ''}`

  const labelNode = icon
    ? (
      <div className="flex items-center gap-1 text-xs text-surface-muted-foreground">
        {icon}
        {label}
      </div>
    )
    : <p className="text-xs text-surface-muted-foreground">{label}</p>

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {labelNode}
        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      </button>
    )
  }

  return (
    <div className={className}>
      {labelNode}
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

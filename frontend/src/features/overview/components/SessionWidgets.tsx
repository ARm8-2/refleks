import { Clock3, Flame, Gamepad2, Gauge, Minus, Pencil, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Area, AreaChart } from 'recharts'
import { Widget } from '../../../shared/components'
import type { ChartConfig } from '../../../shared/components/ui/chart'
import { ChartContainer } from '../../../shared/components/ui/chart'
import { cn } from '../../../shared/lib'
import { useDailyPlaytime } from '../hooks/useDailyPlaytime'
import { useRecentSessionSnapshot, type SnapshotTone } from '../hooks/useRecentSessionSnapshot'

// ─── Small metric widgets ────────────────────────────────────────────

export function SessionLengthWidget() {
  const { currentSession, sessionLengthLabel, sessionLengthDetail } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Clock3} label="Session length" />

  return (
    <MetricWidget icon={Clock3} label="Session length" value={sessionLengthLabel} detail={sessionLengthDetail} />
  )
}

export function ActivePlaytimeWidget() {
  const { currentSession, activePlaytimeLabel, activePlaytimeDetail } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Gamepad2} label="Active playtime" />

  return (
    <MetricWidget icon={Gamepad2} label="Active playtime" value={activePlaytimeLabel} detail={activePlaytimeDetail} />
  )
}

export function DailyStreakWidget() {
  const { currentSession, streakLabel, streakDetail } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Flame} label="Daily streak" />

  return (
    <MetricWidget
      icon={Flame}
      label="Daily streak"
      value={streakLabel}
      detail={streakDetail}
      accentClassName="text-[color:var(--streak)]"
    />
  )
}

export function SessionPerformanceWidget() {
  const { currentSession, statusTone, performanceValue, performanceDetail, statusLabel } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Gauge} label="Session performance" />

  const StatusIcon = getStatusIcon(statusTone)

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Gauge className={cn('h-3.5 w-3.5', getPerformanceAccent(statusTone))} />Session performance</span>}
      className="px-4 py-3"
      headerActions={
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', getToneBadgeClasses(statusTone))}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>
      }
    >
      <div className={cn('text-lg font-semibold', getPerformanceAccent(statusTone))}>{performanceValue}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{performanceDetail}</div>
    </Widget>
  )
}

// ─── Session progress (radial chart with phases) ────────────────────

export function SessionProgressWidget() {
  const {
    currentSession,
    currentRuns,
    suggestedRuns,
    warmupRuns,
    peakStart,
    peakEnd,
    diminishingReturnsAt,
    sessionsAnalyzed,
  } = useRecentSessionSnapshot()

  const [customTarget, setCustomTarget] = useState<number | null>(() => {
    const stored = localStorage.getItem('refleks:sessionTarget')
    return stored ? Number(stored) : null
  })
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const targetRuns = customTarget ?? suggestedRuns
  const isCustom = customTarget !== null

  const saveTarget = useCallback((value: number | null) => {
    setCustomTarget(value)
    if (value !== null) {
      localStorage.setItem('refleks:sessionTarget', String(value))
    } else {
      localStorage.removeItem('refleks:sessionTarget')
    }
    setEditing(false)
  }, [])

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(e.currentTarget.value, 10)
      saveTarget(Number.isFinite(parsed) && parsed > 0 ? parsed : null)
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }, [saveTarget])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (!currentSession) {
    return (
      <Widget title="Session Progress" className="px-4 py-3">
        <div className="flex h-full items-center justify-center rounded-xl bg-muted-strong p-4 text-sm text-muted-foreground">
          Play or import a few runs to see session progress.
        </div>
      </Widget>
    )
  }

  const pct = targetRuns > 0
    ? Math.min(Math.round((currentRuns / targetRuns) * 100), 100)
    : 0

  // Build phase arc data for the background ring
  const maxRun = Math.max(targetRuns, diminishingReturnsAt, currentRuns, 12)
  const toAngle = (run: number) => 90 - (Math.min(run, maxRun) / maxRun) * 360
  const warmupEnd = Math.min(warmupRuns, maxRun)
  const peakEndClamped = Math.min(peakEnd, maxRun)
  const dimEnd = Math.min(diminishingReturnsAt, maxRun)
  const progressAngle = 90 - (Math.min(currentRuns, maxRun) / maxRun) * 360

  // Ring dimensions
  const outerR = 86
  const innerR = 64
  const cx = 100
  const cy = 100

  function arcPath(startRun: number, endRun: number): string {
    const a1 = (toAngle(startRun) * Math.PI) / 180
    const a2 = (toAngle(endRun) * Math.PI) / 180
    const x1 = cx + outerR * Math.cos(a1)
    const y1 = cy - outerR * Math.sin(a1)
    const x2 = cx + outerR * Math.cos(a2)
    const y2 = cy - outerR * Math.sin(a2)
    const ix1 = cx + innerR * Math.cos(a2)
    const iy1 = cy - innerR * Math.sin(a2)
    const ix2 = cx + innerR * Math.cos(a1)
    const iy2 = cy - innerR * Math.sin(a1)
    const sweep = Math.abs(a1 - a2) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${sweep} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${sweep} 0 ${ix2} ${iy2} Z`
  }

  return (
    <Widget
      title="Session Progress"
      className="px-4 py-3"
      headerActions={
        <div className="flex items-center gap-1.5">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              min={1}
              defaultValue={targetRuns}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
              onKeyDown={handleEditKeyDown}
              onBlur={() => setEditing(false)}
            />
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {targetRuns} target{isCustom ? '' : ' (auto)'}
              </span>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(true)}
                title="Edit target"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {isCustom && (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => saveTarget(null)}
                  title="Reset to automatic"
                >
                  reset
                </button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <div className="relative aspect-square h-[180px] shrink-0">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {/* Background ring */}
            <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="var(--muted)" strokeWidth={outerR - innerR} />

            {/* Phase arcs */}
            <path d={arcPath(0, warmupEnd)} fill="rgb(245 159 10 / 0.18)" />
            <path d={arcPath(peakStart - 1, peakEndClamped)} fill="rgb(16 183 127 / 0.18)" />
            {dimEnd < maxRun && (
              <path d={arcPath(dimEnd, maxRun)} fill="rgb(239 68 68 / 0.12)" />
            )}

            {/* Progress arc */}
            {currentRuns > 0 && (
              <path d={arcPath(0, currentRuns)} fill="var(--chart-2)" opacity={0.55} />
            )}

            {/* Center text */}
            <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
              {currentRuns}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
              / {targetRuns} target
            </text>
          </svg>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="rounded-lg bg-secondary px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Progress</div>
            <div className="text-base font-semibold text-foreground">{pct}%</div>
          </div>
          <div className="rounded-lg bg-secondary px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Warm-up</div>
            <div className="text-base font-semibold text-foreground">1–{warmupRuns}</div>
          </div>
          <div className="rounded-lg bg-secondary px-3 py-2">
            <div className="text-[11px] text-muted-foreground">Peak zone</div>
            <div className="text-base font-semibold text-foreground">{peakStart}–{peakEnd}</div>
          </div>
        </div>
      </div>
    </Widget>
  )
}

// ─── Playtime history sparkline ─────────────────────────────────────

const playtimeConfig: ChartConfig = {
  minutes: { label: 'Playtime', color: 'var(--chart-1)' },
}

export function PlaytimeHistoryWidget() {
  const points = useDailyPlaytime(7)
  const hasData = points.some(p => p.minutes > 0)
  const totalMinutes = points.reduce((sum, p) => sum + p.minutes, 0)

  return (
    <Widget
      title="Playtime (7d)"
      className="px-4 py-3"
      headerActions={hasData ? (
        <span className="text-xs font-medium text-foreground">{formatMinutes(totalMinutes)}</span>
      ) : null}
    >
      <ChartContainer config={playtimeConfig} className="aspect-auto h-[44px] w-full">
        <AreaChart data={points} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="playtimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-minutes)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-minutes)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="minutes"
            stroke="var(--color-minutes)"
            fill="url(#playtimeFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </Widget>
  )
}

// ─── Shared helpers ─────────────────────────────────────────────────

function MetricWidget({
  icon: Icon,
  label,
  value,
  detail,
  accentClassName,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  accentClassName?: string
}) {
  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Icon className={cn('h-3.5 w-3.5', accentClassName)} />{label}</span>}
      className="px-4 py-3"
    >
      <div className={cn('text-lg font-semibold text-foreground', accentClassName)}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </Widget>
  )
}

function EmptyMetricWidget({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>}
      className="px-4 py-3"
    >
      <div className="text-lg font-semibold text-muted-foreground">--</div>
      <div className="mt-0.5 text-xs text-muted-foreground">No session loaded</div>
    </Widget>
  )
}

function getStatusIcon(tone: SnapshotTone): LucideIcon {
  switch (tone) {
    case 'success': return TrendingUp
    case 'warning': return TrendingDown
    case 'neutral': return Minus
    case 'muted':
    default: return Gauge
  }
}

function getToneBadgeClasses(tone: SnapshotTone): string {
  switch (tone) {
    case 'success': return 'border-transparent bg-[rgb(16_183_127_/_0.14)] text-[color:var(--success)]'
    case 'warning': return 'border-transparent bg-[rgb(245_159_10_/_0.16)] text-[rgb(180_110_0)] dark:text-[rgb(255_201_107)]'
    case 'neutral': return 'border-primary-border bg-primary-soft text-primary'
    case 'muted':
    default: return 'border-border-soft bg-muted-soft text-muted-foreground'
  }
}

function getPerformanceAccent(tone: SnapshotTone): string {
  switch (tone) {
    case 'success': return 'text-[color:var(--success)]'
    case 'warning': return 'text-[color:var(--warning)]'
    case 'neutral': return 'text-primary'
    case 'muted':
    default: return 'text-muted-foreground'
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return '<1m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

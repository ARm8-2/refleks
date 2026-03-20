import { InfoTooltip, Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { usePersistedState } from '@/shared/hooks'
import { cn } from '@/shared/lib'
import { Activity, Clock3, Crosshair, Flame, Gamepad2, Gauge, Minus, Pencil, Plus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { useDailyPlaytime } from '../hooks/useDailyPlaytime'
import { useRecentSessionSnapshot, type SnapshotTone } from '../hooks/useRecentSessionSnapshot'

const SESSION_TARGET_STORAGE_KEY = 'refleks.overview.sessionProgress.targetRuns'


/* ─── Session & Playtime (merged) ─── */

export function SessionTimeWidget() {
  const { currentSession, sessionLengthLabel, sessionLengthDetail, activePlaytimeLabel, activePlaytimeDetail } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Clock3} label="Session & Playtime" />

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Session & Playtime</span>}
      className="px-4 py-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-foreground">{sessionLengthLabel}</span>
        <span className="text-xs text-muted-foreground">{sessionLengthDetail}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <Gamepad2 className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{activePlaytimeLabel}</span>
        <span className="text-xs text-muted-foreground">{activePlaytimeDetail}</span>
      </div>
    </Widget>
  )
}

/* ─── Streak & Daily Playtime (merged) ─── */

const playtimeConfig: ChartConfig = {
  minutes: { label: 'Playtime', color: 'var(--chart-3)' },
}

export function StreakPlaytimeWidget() {
  const { currentSession, streakLabel, streakDetail } = useRecentSessionSnapshot()
  const points = useDailyPlaytime(7)
  const hasData = points.some(p => p.minutes > 0)
  const chartData = hasData ? points : points.map(p => ({ ...p, minutes: 0.5 }))

  if (!currentSession) return <EmptyMetricWidget icon={Flame} label="Streak & Playtime" />

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-[color:var(--streak)]" />Streak & Playtime</span>}
      className="px-4 py-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-[color:var(--streak)]">{streakLabel}</span>
        <span className="text-xs text-muted-foreground">{streakDetail}</span>
      </div>
      <ChartContainer config={playtimeConfig} className="mt-0.5 aspect-auto h-[28px] w-full">
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
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </Widget>
  )
}

/* ─── Last Run: Score & Accuracy ─── */

export function LastRunWidget() {
  const { currentSession, lastRunScore, lastRunAccuracy, lastRunScoreTrend, lastRunAccTrend, lastRunScenario, recentScores } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Activity} label="Last Run" />

  if (lastRunScore === null && lastRunAccuracy === null) {
    return (
      <Widget
        title={<span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Last Run</span>}
        className="px-4 py-3"
      >
        <div className="text-lg font-semibold text-muted-foreground">--</div>
        <div className="mt-0.5 text-xs text-muted-foreground">No score data</div>
      </Widget>
    )
  }

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Last Run</span>}
      className="px-4 py-3"
      headerActions={
        lastRunScenario ? <span className="max-w-[120px] truncate text-[11px] text-muted-foreground" title={lastRunScenario}>{lastRunScenario}</span> : null
      }
    >
      <div className="flex items-center gap-4">
        {lastRunScore !== null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-foreground">{formatScore(lastRunScore)}</span>
            <TrendIndicator trend={lastRunScoreTrend} />
          </div>
        )}
        {lastRunAccuracy !== null && (
          <div className="flex items-baseline gap-1.5">
            <Crosshair className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{lastRunAccuracy.toFixed(1)}%</span>
            <TrendIndicator trend={lastRunAccTrend} />
          </div>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{lastRunScoreTrend !== null ? 'Trend: last 40% vs first 60%' : 'Score & accuracy'}</span>
        {recentScores.length > 0 && <span className="ml-auto tabular-nums">{recentScores.length} {recentScores.length === 1 ? 'run' : 'runs'}</span>}
      </div>
    </Widget>
  )
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' | null }) {
  if (!trend || trend === 'flat') return null
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" />
  return <TrendingDown className="h-3.5 w-3.5 text-[color:var(--warning)]" />
}

function formatScore(score: number): string {
  return score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score.toFixed(0)
}

/* ─── Session Performance (compact) ─── */

export function SessionPerformanceWidget() {
  const { currentSession, statusTone, performanceValue, performanceDetail, statusLabel } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Gauge} label="Performance" />

  const StatusIcon = getStatusIcon(statusTone)

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Gauge className={cn('h-3.5 w-3.5', getPerformanceAccent(statusTone))} />Performance</span>}
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


export function SessionProgressWidget() {
  const {
    currentSession,
    currentRuns,
    suggestedRuns,
    warmupRuns,
    peakStart,
    peakEnd,
    diminishingReturnsAt,
  } = useRecentSessionSnapshot()

  const [customTarget, setCustomTarget] = usePersistedState<number | null>(
    SESSION_TARGET_STORAGE_KEY,
    null,
  )
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const targetRuns = customTarget ?? suggestedRuns
  const isCustom = customTarget !== null

  const saveTarget = useCallback((value: number | null) => {
    setCustomTarget(value)
    setEditing(false)
  }, [setCustomTarget])

  const commitTarget = useCallback((rawValue: string) => {
    const parsed = parseInt(rawValue, 10)
    saveTarget(Number.isFinite(parsed) && parsed > 0 ? parsed : null)
  }, [saveTarget])

  const adjustPendingTarget = useCallback((delta: number) => {
    if (!inputRef.current) return

    const parsed = parseInt(inputRef.current.value, 10)
    const currentValue = Number.isFinite(parsed) ? parsed : targetRuns
    inputRef.current.value = String(Math.max(1, currentValue + delta))
  }, [targetRuns])

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitTarget(e.currentTarget.value)
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }, [commitTarget])

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
            <div className="flex items-center overflow-hidden rounded bg-secondary">
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                onMouseDown={(e) => {
                  e.preventDefault()
                  adjustPendingTarget(-1)
                }}
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <input
                ref={inputRef}
                type="number"
                min={1}
                defaultValue={targetRuns}
                className="w-8 border-x border-border bg-secondary py-0.5 text-center text-xs text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onKeyDown={handleEditKeyDown}
                onBlur={(e) => commitTarget(e.currentTarget.value)}
              />
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                onMouseDown={(e) => {
                  e.preventDefault()
                  adjustPendingTarget(1)
                }}
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
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
      <div className="relative mx-auto flex flex-1 items-center justify-center">
        <div className="relative aspect-square w-full max-w-[160px] shrink-0">
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
            <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
              {currentRuns}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
              / {targetRuns} target
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
              {pct}%
            </text>
          </svg>
        </div>

        <div className="absolute bottom-0 right-0">
          <InfoTooltip side="left">
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(245 159 10 / 0.6)' }} />
                <span className="text-popover-foreground/70">Warm-up</span>
                <span className="ml-auto font-medium text-popover-foreground">1–{warmupRuns}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(16 183 127 / 0.6)' }} />
                <span className="text-popover-foreground/70">Peak</span>
                <span className="ml-auto font-medium text-popover-foreground">{peakStart}–{peakEnd}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(239 68 68 / 0.5)' }} />
                <span className="text-popover-foreground/70">Diminishing</span>
                <span className="ml-auto font-medium text-popover-foreground">{diminishingReturnsAt}+</span>
              </div>
            </div>
          </InfoTooltip>
        </div>
      </div>
    </Widget>
  )
}

/* ─── Recent Scores Widget ─── */

const recentScoresConfig: ChartConfig = {
  score: { label: 'Score', color: 'var(--chart-2)' },
}

export function RecentScoresWidget() {
  const { currentSession, recentScores, recentScoresScenario, recentScoresSessionBest, recentScoresPb } = useRecentSessionSnapshot()
  const [runCount, setRunCount] = useState(10)
  const [showSessionBest, setShowSessionBest] = useState(true)
  const [showPb, setShowPb] = useState(false)

  const compactData = useMemo(() => recentScores.slice(-10), [recentScores])
  const expandedData = useMemo(() => {
    const sliced = runCount >= recentScores.length ? recentScores : recentScores.slice(-runCount)
    // Re-index for display
    return sliced.map((s, i) => ({ ...s, index: i + 1 }))
  }, [recentScores, runCount])

  if (!currentSession || recentScores.length === 0) {
    return (
      <Widget title="Recent Scores" className="px-4 py-3">
        <div className="flex h-full items-center justify-center rounded-xl bg-muted-strong p-4 text-sm text-muted-foreground">
          Play a scenario to see recent scores here.
        </div>
      </Widget>
    )
  }

  const runCountOptions = [10, 20, 50]

  function renderReferenceLines() {
    return (
      <>
        {showSessionBest && recentScoresSessionBest !== null && (
          <ReferenceLine y={recentScoresSessionBest} stroke="var(--chart-3)" strokeDasharray="6 3" strokeWidth={1.5} />
        )}
        {showPb && recentScoresPb !== null && (
          <ReferenceLine y={recentScoresPb} stroke="var(--chart-1)" strokeDasharray="6 3" strokeWidth={1.5} />
        )}
      </>
    )
  }

  function renderCompactChart() {
    return (
      <ChartContainer config={recentScoresConfig} className="aspect-auto w-full h-full min-h-[140px]">
        <LineChart data={compactData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} tickFormatter={v => formatScoreCompact(v)} domain={['dataMin - 50', 'auto']} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {renderReferenceLines()}
          <Line isAnimationActive={false} type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--color-score)' }} activeDot={{ r: 4 }} />
        </LineChart>
      </ChartContainer>
    )
  }

  function renderExpandedChart() {
    return (
      <ChartContainer config={recentScoresConfig} className="aspect-auto w-full h-[360px]">
        <LineChart data={expandedData} margin={{ top: 12, right: 12, left: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="index" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => formatScoreCompact(v)} domain={['dataMin - 50', 'auto']} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {showSessionBest && recentScoresSessionBest !== null && (
            <ReferenceLine y={recentScoresSessionBest} stroke="var(--chart-3)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `SB: ${formatScoreCompact(recentScoresSessionBest)}`, position: 'right', fill: 'var(--chart-3)', fontSize: 11 }} />
          )}
          {showPb && recentScoresPb !== null && (
            <ReferenceLine y={recentScoresPb} stroke="var(--chart-1)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `PB: ${formatScoreCompact(recentScoresPb)}`, position: 'right', fill: 'var(--chart-1)', fontSize: 11 }} />
          )}
          <Line isAnimationActive={false} type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--color-score)' }} activeDot={{ r: 4 }} />
        </LineChart>
      </ChartContainer>
    )
  }

  const modalControls = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
        {runCountOptions.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRunCount(n)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
              runCount === n
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {`Last ${n}`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5 rounded-xl bg-secondary p-1">
        <button
          type="button"
          onClick={() => setShowSessionBest(v => !v)}
          className={cn(
            'flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
            showSessionBest ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          Session Best
        </button>
        <button
          type="button"
          onClick={() => setShowPb(v => !v)}
          className={cn(
            'flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
            showPb ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          PB
        </button>
      </div>
    </div>
  )

  return (
    <Widget
      title="Recent Scores"
      className="px-4 py-3"
      modalTitle={recentScoresScenario || 'Recent Scores'}
      modalHeaderActions={modalControls}
      modalContent={renderExpandedChart()}
      contentClassName="flex flex-col h-full"
    >
      {renderCompactChart()}
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

function formatScoreCompact(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(1)}k`
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`
  return score.toFixed(0)
}

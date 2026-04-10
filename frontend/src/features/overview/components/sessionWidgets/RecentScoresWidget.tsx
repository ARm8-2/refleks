import { SegmentedControl, TogglePill, TogglePillGroup, Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { usePersistedState } from '@/shared/hooks'
import { CHART_SERIES_COLORS, CHART_STYLE, primeHistoryRunSelection, STORAGE_KEYS } from '@/shared/lib'
import { useId, useMemo, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { RecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { buildScoreDomain, formatScoreCompact } from './shared'

const RECENT_SCORE_RUN_COUNT_OPTIONS = [10, 20, 50] as const
const REFERENCE_LABEL_OVERLAP_RATIO = 0.08

const recentScoresConfig: ChartConfig = {
  score: { label: 'Score', color: CHART_SERIES_COLORS.scoreHistory },
}

type RecentScorePoint = {
  index: number
  score: number
  inCurrentSession: boolean
  runId: string
  sessionId: string
  fill: string
}

function currentSessionStartRatio(points: RecentScorePoint[]): number | null {
  const firstCurrentIndex = points.findIndex(point => point.inCurrentSession)
  if (firstCurrentIndex < 0) return null
  if (points.length <= 1) return 0
  return firstCurrentIndex / (points.length - 1)
}

export function RecentScoresWidget({ snapshot }: { snapshot: RecentSessionSnapshot }) {
  const navigate = useNavigate()
  const gradientBaseId = useId().replace(/:/g, '')
  const {
    currentSession,
    recentScores,
    recentScoresScenario,
    recentScoresSessionBest,
    recentScoresPb,
  } = snapshot
  const [runCount, setRunCount] = usePersistedState<number>(STORAGE_KEYS.overviewRecentScoresRunCount, 10)
  const [showSessionBest, setShowSessionBest] = usePersistedState<boolean>(STORAGE_KEYS.overviewRecentScoresShowSessionBest, true)
  const [showPb, setShowPb] = usePersistedState<boolean>(STORAGE_KEYS.overviewRecentScoresShowPb, false)

  const effectiveRunCount = RECENT_SCORE_RUN_COUNT_OPTIONS.includes(runCount as (typeof RECENT_SCORE_RUN_COUNT_OPTIONS)[number])
    ? runCount
    : 10

  const compactData = useMemo(
    () => recentScores.slice(-10).map(point => ({
      ...point,
      fill: point.inCurrentSession ? CHART_SERIES_COLORS.scoreCurrent : 'var(--color-score)',
    })),
    [recentScores],
  )
  const compactSessionSplitRatio = useMemo(() => currentSessionStartRatio(compactData), [compactData])

  const expandedData = useMemo(() => {
    const sliced = effectiveRunCount >= recentScores.length ? recentScores : recentScores.slice(-effectiveRunCount)
    return sliced.map((s, i) => ({
      ...s,
      index: i + 1,
      fill: s.inCurrentSession ? CHART_SERIES_COLORS.scoreCurrent : 'var(--color-score)',
    }))
  }, [recentScores, effectiveRunCount])
  const expandedSessionSplitRatio = useMemo(() => currentSessionStartRatio(expandedData), [expandedData])

  const referenceScores = useMemo(
    () => [
      showSessionBest ? recentScoresSessionBest : null,
      showPb ? recentScoresPb : null,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    [recentScoresPb, recentScoresSessionBest, showPb, showSessionBest],
  )

  const compactScoreDomain = useMemo(
    () => buildScoreDomain(compactData.map(point => point.score), referenceScores),
    [compactData, referenceScores],
  )

  const expandedScoreDomain = useMemo(
    () => buildScoreDomain(expandedData.map(point => point.score), referenceScores),
    [expandedData, referenceScores],
  )

  const handlePointClick = (state: { activeTooltipIndex?: number } | null, data: RecentScorePoint[]) => {
    if (!state || state.activeTooltipIndex == null) return
    const point = data[state.activeTooltipIndex]
    if (!point?.runId || !point?.sessionId) return

    primeHistoryRunSelection(point.runId, point.sessionId)
    navigate('/history')
  }

  if (!currentSession || recentScores.length === 0) {
    return (
      <Widget title="Recent Scores">
        <div className="flex h-full items-center justify-center rounded-xl bg-surface-muted-strong p-4 text-sm text-surface-muted-foreground">
          Play a scenario to see recent scores here.
        </div>
      </Widget>
    )
  }

  const renderScoreDot = (props: { cx?: number; cy?: number; payload?: { fill?: string; inCurrentSession?: boolean } }): ReactElement => {
    const hasPosition = typeof props.cx === 'number' && typeof props.cy === 'number'
    const fill = props.payload?.fill ?? (props.payload?.inCurrentSession ? CHART_SERIES_COLORS.scoreCurrent : 'var(--color-score)')

    return (
      <circle
        cx={hasPosition ? props.cx : 0}
        cy={hasPosition ? props.cy : 0}
        r={hasPosition ? CHART_STYLE.pointRadius : 0}
        fill={fill}
        strokeWidth={0}
      />
    )
  }

  const renderActiveScoreDot = (props: { cx?: number; cy?: number; payload?: { fill?: string; inCurrentSession?: boolean } }): ReactElement => {
    const hasPosition = typeof props.cx === 'number' && typeof props.cy === 'number'
    const fill = props.payload?.fill ?? (props.payload?.inCurrentSession ? CHART_SERIES_COLORS.scoreCurrent : 'var(--color-score)')

    return (
      <circle
        cx={hasPosition ? props.cx : 0}
        cy={hasPosition ? props.cy : 0}
        r={hasPosition ? CHART_STYLE.activePointRadius : 0}
        fill={fill}
        strokeWidth={0}
      />
    )
  }

  function renderReferenceLines() {
    return (
      <>
        {showSessionBest && recentScoresSessionBest !== null && (
          <ReferenceLine y={recentScoresSessionBest} stroke={CHART_SERIES_COLORS.accuracy} strokeDasharray={CHART_STYLE.referenceDash} strokeWidth={CHART_STYLE.lineSecondaryWidth} />
        )}
        {showPb && recentScoresPb !== null && (
          <ReferenceLine y={recentScoresPb} stroke={CHART_SERIES_COLORS.scoreCurrent} strokeDasharray={CHART_STYLE.referenceDash} strokeWidth={CHART_STYLE.lineSecondaryWidth} />
        )}
      </>
    )
  }

  function renderSplitGradient(gradientId: string, ratio: number | null) {
    if (ratio === null) {
      return (
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-score)" />
          <stop offset="100%" stopColor="var(--color-score)" />
        </linearGradient>
      )
    }

    if (ratio <= 0) {
      return (
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={CHART_SERIES_COLORS.scoreCurrent} />
          <stop offset="100%" stopColor={CHART_SERIES_COLORS.scoreCurrent} />
        </linearGradient>
      )
    }

    if (ratio >= 1) {
      return (
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-score)" />
          <stop offset="100%" stopColor="var(--color-score)" />
        </linearGradient>
      )
    }

    const splitOffset = `${(ratio * 100).toFixed(3)}%`
    return (
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--color-score)" />
        <stop offset={splitOffset} stopColor="var(--color-score)" />
        <stop offset={splitOffset} stopColor={CHART_SERIES_COLORS.scoreCurrent} />
        <stop offset="100%" stopColor={CHART_SERIES_COLORS.scoreCurrent} />
      </linearGradient>
    )
  }

  function renderCompactChart() {
    const compactGradientId = `recent-scores-compact-${gradientBaseId}`
    return (
      <ChartContainer config={recentScoresConfig} className="aspect-auto w-full h-full min-h-[140px]">
        <LineChart
          data={compactData}
          margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
          onClick={state => handlePointClick(state, compactData)}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            {renderSplitGradient(compactGradientId, compactSessionSplitRatio)}
          </defs>
          <XAxis dataKey="index" hide />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} tickFormatter={v => formatScoreCompact(v)} domain={compactScoreDomain} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {renderReferenceLines()}
          <Line isAnimationActive={false} type="monotone" dataKey="score" stroke={`url(#${compactGradientId})`} strokeWidth={CHART_STYLE.linePrimaryWidth} dot={renderScoreDot} activeDot={renderActiveScoreDot} />
        </LineChart>
      </ChartContainer>
    )
  }

  function renderExpandedChart() {
    const expandedGradientId = `recent-scores-expanded-${gradientBaseId}`
    const sessionBestScore = recentScoresSessionBest ?? 0
    const personalBestScore = recentScoresPb ?? 0
    const domainSpan = Math.max(1, expandedScoreDomain[1] - expandedScoreDomain[0])
    const labelsMayOverlap =
      showSessionBest &&
      showPb &&
      recentScoresSessionBest !== null &&
      recentScoresPb !== null &&
      Math.abs(recentScoresSessionBest - recentScoresPb) <= domainSpan * REFERENCE_LABEL_OVERLAP_RATIO

    const pbAboveSb = personalBestScore >= sessionBestScore

    const renderSessionBestLineLabel = (props: { viewBox?: { x?: number; y?: number } }): ReactElement => {
      const x = typeof props.viewBox?.x === 'number' ? props.viewBox.x : 0
      const y = typeof props.viewBox?.y === 'number' ? props.viewBox.y : 0
      const offset = labelsMayOverlap ? (pbAboveSb ? 14 : -6) : -6
      const labelY = Math.max(14, y + offset)

      return (
        <text x={x + 10} y={labelY} fill={CHART_SERIES_COLORS.accuracy} fontSize={11} fontWeight={500}>
          {`Session Best: ${formatScoreCompact(sessionBestScore)}`}
        </text>
      )
    }

    const renderPersonalBestLineLabel = (props: { viewBox?: { x?: number; y?: number } }): ReactElement => {
      const x = typeof props.viewBox?.x === 'number' ? props.viewBox.x : 0
      const y = typeof props.viewBox?.y === 'number' ? props.viewBox.y : 0
      const offset = labelsMayOverlap ? (pbAboveSb ? -6 : 14) : -6
      const labelY = Math.max(14, y + offset)

      return (
        <text x={x + 10} y={labelY} fill={CHART_SERIES_COLORS.scoreCurrent} fontSize={11} fontWeight={500}>
          {`Personal Best: ${formatScoreCompact(personalBestScore)}`}
        </text>
      )
    }

    return (
      <ChartContainer config={recentScoresConfig} className="aspect-auto w-full h-full">
        <LineChart
          data={expandedData}
          margin={{ top: 12, right: 12, left: 6, bottom: 0 }}
          onClick={state => handlePointClick(state, expandedData)}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            {renderSplitGradient(expandedGradientId, expandedSessionSplitRatio)}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="index" hide />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => formatScoreCompact(v)} domain={expandedScoreDomain} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {showSessionBest && recentScoresSessionBest !== null && (
            <ReferenceLine y={recentScoresSessionBest} stroke={CHART_SERIES_COLORS.accuracy} strokeDasharray={CHART_STYLE.referenceDash} strokeWidth={CHART_STYLE.lineSecondaryWidth} label={renderSessionBestLineLabel} />
          )}
          {showPb && recentScoresPb !== null && (
            <ReferenceLine y={recentScoresPb} stroke={CHART_SERIES_COLORS.scoreCurrent} strokeDasharray={CHART_STYLE.referenceDash} strokeWidth={CHART_STYLE.lineSecondaryWidth} label={renderPersonalBestLineLabel} />
          )}
          <Line isAnimationActive={false} type="monotone" dataKey="score" stroke={`url(#${expandedGradientId})`} strokeWidth={CHART_STYLE.linePrimaryWidth} dot={renderScoreDot} activeDot={renderActiveScoreDot} />
        </LineChart>
      </ChartContainer>
    )
  }

  const modalControls = (
    <div className="flex items-center gap-2">
      <SegmentedControl
        value={effectiveRunCount}
        options={RECENT_SCORE_RUN_COUNT_OPTIONS.map(n => ({ value: n, label: `Last ${n}` }))}
        onValueChange={setRunCount}
        size="sm"
      />
      <TogglePillGroup>
        <TogglePill active={showSessionBest} onClick={() => setShowSessionBest(v => !v)}>
          Session Best
        </TogglePill>
        <TogglePill active={showPb} onClick={() => setShowPb(v => !v)}>
          Personal Best
        </TogglePill>
      </TogglePillGroup>
    </div>
  )

  return (
    <Widget
      title="Recent Scores"
      modalTitle={recentScoresScenario || 'Recent Scores'}
      modalControls={modalControls}
      modalContent={renderExpandedChart()}
      contentClassName="flex flex-col h-full"
    >
      {renderCompactChart()}
    </Widget>
  )
}

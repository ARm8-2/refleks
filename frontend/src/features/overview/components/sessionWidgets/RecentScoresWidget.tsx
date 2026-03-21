import { Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { cn } from '@/shared/lib'
import { useMemo, useState, type ReactElement } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { useRecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { buildScoreDomain, formatScoreCompact } from './shared'

const recentScoresConfig: ChartConfig = {
  score: { label: 'Score', color: 'var(--chart-2)' },
}

export function RecentScoresWidget() {
  const {
    currentSession,
    recentScores,
    recentScoresScenario,
    recentScoresSessionBest,
    recentScoresPb,
    recentScoresSessionStartIndex,
  } = useRecentSessionSnapshot()
  const [runCount, setRunCount] = useState(10)
  const [showSessionBest, setShowSessionBest] = useState(true)
  const [showPb, setShowPb] = useState(false)

  const compactData = useMemo(() => recentScores.slice(-10), [recentScores])
  const compactSessionStartIndex = useMemo(() => {
    if (recentScoresSessionStartIndex === null || compactData.length === 0) return null
    const compactStartIndex = recentScores.length - compactData.length + 1
    if (recentScoresSessionStartIndex < compactStartIndex) return null
    return recentScoresSessionStartIndex
  }, [compactData.length, recentScores.length, recentScoresSessionStartIndex])

  const expandedData = useMemo(() => {
    const sliced = runCount >= recentScores.length ? recentScores : recentScores.slice(-runCount)
    return sliced.map((s, i) => ({ ...s, index: i + 1 }))
  }, [recentScores, runCount])

  const expandedSessionStartIndex = useMemo(() => {
    if (recentScoresSessionStartIndex === null || expandedData.length === 0) return null
    const expandedStartIndex = recentScores.length - expandedData.length + 1
    if (recentScoresSessionStartIndex < expandedStartIndex) return null
    return recentScoresSessionStartIndex - expandedStartIndex + 1
  }, [expandedData.length, recentScores.length, recentScoresSessionStartIndex])

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

  const renderScoreDot = (props: { cx?: number; cy?: number; payload?: { inCurrentSession?: boolean } }): ReactElement => {
    const hasPosition = typeof props.cx === 'number' && typeof props.cy === 'number'
    const isCurrentSession = props.payload?.inCurrentSession === true
    const fill = isCurrentSession ? 'var(--chart-1)' : 'var(--color-score)'

    return (
      <circle
        cx={hasPosition ? props.cx : 0}
        cy={hasPosition ? props.cy : 0}
        r={hasPosition ? 2.7 : 0}
        fill={fill}
        strokeWidth={0}
      />
    )
  }

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
          <XAxis dataKey="index" hide />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} tickFormatter={v => formatScoreCompact(v)} domain={compactScoreDomain} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {renderReferenceLines()}
          {compactSessionStartIndex !== null && (
            <ReferenceLine x={compactSessionStartIndex} stroke="var(--chart-1)" strokeDasharray="3 3" strokeWidth={1} />
          )}
          <Line isAnimationActive={false} type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={renderScoreDot} activeDot={{ r: 4 }} />
        </LineChart>
      </ChartContainer>
    )
  }

  function renderExpandedChart() {
    const sessionBestScore = recentScoresSessionBest ?? 0
    const personalBestScore = recentScoresPb ?? 0
    const domainSpan = Math.max(1, expandedScoreDomain[1] - expandedScoreDomain[0])
    const labelsMayOverlap =
      showSessionBest &&
      showPb &&
      recentScoresSessionBest !== null &&
      recentScoresPb !== null &&
      Math.abs(recentScoresSessionBest - recentScoresPb) <= domainSpan * 0.08

    const pbAboveSb = personalBestScore >= sessionBestScore

    const renderSessionBestLineLabel = (props: { viewBox?: { x?: number; y?: number } }): ReactElement => {
      const x = typeof props.viewBox?.x === 'number' ? props.viewBox.x : 0
      const y = typeof props.viewBox?.y === 'number' ? props.viewBox.y : 0
      const offset = labelsMayOverlap ? (pbAboveSb ? 14 : -6) : -6
      const labelY = Math.max(14, y + offset)

      return (
        <text x={x + 10} y={labelY} fill="var(--chart-3)" fontSize={11} fontWeight={500}>
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
        <text x={x + 10} y={labelY} fill="var(--chart-1)" fontSize={11} fontWeight={500}>
          {`Personal Best: ${formatScoreCompact(personalBestScore)}`}
        </text>
      )
    }

    return (
      <ChartContainer config={recentScoresConfig} className="aspect-auto w-full h-[360px]">
        <LineChart data={expandedData} margin={{ top: 12, right: 12, left: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="index" hide />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => formatScoreCompact(v)} domain={expandedScoreDomain} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {showSessionBest && recentScoresSessionBest !== null && (
            <ReferenceLine y={recentScoresSessionBest} stroke="var(--chart-3)" strokeDasharray="6 3" strokeWidth={1.5} label={renderSessionBestLineLabel} />
          )}
          {showPb && recentScoresPb !== null && (
            <ReferenceLine y={recentScoresPb} stroke="var(--chart-1)" strokeDasharray="6 3" strokeWidth={1.5} label={renderPersonalBestLineLabel} />
          )}
          {expandedSessionStartIndex !== null && (
            <ReferenceLine x={expandedSessionStartIndex} stroke="var(--chart-1)" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'Session start', position: 'insideTopLeft', fill: 'var(--chart-1)', fontSize: 10 }} />
          )}
          <Line isAnimationActive={false} type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={renderScoreDot} activeDot={{ r: 4 }} />
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
          Personal Best
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

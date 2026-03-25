import { InfoTooltip } from '@/shared/components'
import { getScenarioTrace } from '@/shared/lib'
import { cn } from '@/shared/lib/utils'
import type { MousePoint } from '@/shared/types/ipc'
import { Copy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { decodeTrace } from '../../lib/decodeTrace'
import type { HistoryRun } from '../../lib/historyModels'
import {
  computeMouseTraceAnalysis,
  computeSuggestedSens,
  type KillAnalysis,
  type MouseTraceAnalysis,
  type SensSuggestion,
} from '../../lib/mouseAnalysis'
import type { TraceHighlight } from '../../lib/traceRenderer'
import { TraceReplay } from '../TraceReplay'

/* ─── Trace data hook ─── */

function useTraceData(run: HistoryRun | null) {
  const [points, setPoints] = useState<MousePoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasTrace = !!run && !!run.item.hasTrace
  const fileName = run?.item.fileName ?? null
  const flagHasTrace = run?.item.hasTrace ?? false

  useEffect(() => {
    setPoints(null)
    setError(null)
    if (!flagHasTrace || !fileName) return

    let cancelled = false
    setLoading(true)
    getScenarioTrace(fileName)
      .then(b64 => {
        if (cancelled) return
        const decoded = decodeTrace(b64)
        setPoints(decoded.length > 0 ? decoded : null)
        if (decoded.length === 0) setError('Trace file was empty')
      })
      .catch(() => { if (!cancelled) setError('Failed to load trace data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fileName, flagHasTrace])

  return { points, loading, error, hasTrace, resolution: String(run?.item.stats?.Resolution ?? '') }
}

/* ─── Kill classification ─── */

const CLASSIFICATION_STYLES = {
  overshoot: {
    dot: 'bg-red-400',
    text: 'text-red-400',
    highlight: 'rgba(239,68,68,0.8)',
  },
  undershoot: {
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    highlight: 'rgba(245,158,11,0.8)',
  },
  optimal: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    highlight: 'rgba(16,185,129,0.8)',
  },
} as const

function isLeftDown(point: MousePoint | undefined): boolean {
  return ((point?.buttons ?? 0) & 1) !== 0
}

function getFlickStartTs(points: MousePoint[], kill: KillAnalysis): number {
  const startIndex = Math.max(0, Math.min(points.length - 1, kill.startIndex))
  const endIndex = Math.max(startIndex, Math.min(points.length - 1, kill.endIndex))
  const clickDownTs: number[] = []

  let prevDown = isLeftDown(points[startIndex])
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const curDown = isLeftDown(points[i])
    if (!prevDown && curDown) {
      clickDownTs.push(points[i].ts)
    }
    prevDown = curDown
  }

  if (clickDownTs.length >= 2) return clickDownTs[clickDownTs.length - 2]
  return kill.startMs
}

/* ─── Formatting helpers ─── */

function fmtNum(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : '-'
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/* ─── Component ─── */

export function TraceTab({ primaryRun, compareRun, overlay }: { primaryRun: HistoryRun; compareRun: HistoryRun | null; overlay: boolean }) {
  const primary = useTraceData(primaryRun)
  const compare = useTraceData(compareRun)

  const [selectedKill, setSelectedKill] = useState<KillAnalysis | null>(null)

  // Reset selection when run changes
  useEffect(() => { setSelectedKill(null) }, [primaryRun])

  // Compute analysis
  const analysis: MouseTraceAnalysis | null = useMemo(() => {
    if (!primary.points || primary.points.length === 0) return null
    return computeMouseTraceAnalysis(primaryRun.item.stats, primaryRun.item.events, primary.points)
  }, [primaryRun.item.stats, primaryRun.item.events, primary.points])

  const suggestion: SensSuggestion | null = useMemo(() => {
    if (!analysis) return null
    return computeSuggestedSens(analysis, primaryRun.item.stats)
  }, [analysis, primaryRun.item.stats])

  // Highlight: show the last flick from the prior click to the current kill click
  const highlight: TraceHighlight | undefined = useMemo(() => {
    if (!selectedKill || !primary.points) return undefined
    return {
      startTs: getFlickStartTs(primary.points, selectedKill),
      endTs: selectedKill.endMs,
      color: CLASSIFICATION_STYLES[selectedKill.classification].highlight,
    }
  }, [selectedKill, primary.points])

  const seekToMs = selectedKill?.endMs ?? null

  const handleKillClick = useCallback((kill: KillAnalysis) => {
    setSelectedKill(prev => prev?.killIdx === kill.killIdx ? null : kill)
  }, [])

  const clearSelection = useCallback(() => setSelectedKill(null), [])

  if (!primary.hasTrace) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-surface-muted-foreground">No mouse trace data. Enable mouse tracking in settings to record traces.</p>
      </div>
    )
  }

  if (primary.loading || compare.loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-surface-muted-foreground">Loading trace…</p>
      </div>
    )
  }

  if (primary.error || !primary.points || primary.points.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-surface-muted-foreground">{primary.error ?? 'No trace data available'}</p>
      </div>
    )
  }

  const hasCompare = compare.points != null && compare.points.length > 0
  const hasAnalysis = analysis != null && analysis.kills.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Trace viewer — takes up remaining space, never shrinks */}
      <div className="min-h-0 flex-1">
        <TraceReplay
          points={primary.points}
          resolution={primary.resolution || undefined}
          comparePoints={hasCompare ? compare.points! : undefined}
          compareResolution={hasCompare ? (compare.resolution || undefined) : undefined}
          layout={hasCompare && !overlay ? 'split' : 'overlay'}
          highlight={highlight}
          seekToMs={seekToMs}
          onReset={clearSelection}
        />
      </div>

      {/* Analysis panel — fixed height, scrollable kill list */}
      {hasAnalysis && (
        <AnalysisPanel
          analysis={analysis}
          suggestion={suggestion}
          selectedKillIdx={selectedKill?.killIdx ?? null}
          onKillClick={handleKillClick}
        />
      )}
    </div>
  )
}

/* ─── Analysis panel ─── */

function AnalysisPanel({ analysis, suggestion, selectedKillIdx, onKillClick }: {
  analysis: MouseTraceAnalysis
  suggestion: SensSuggestion | null
  selectedKillIdx: number | null
  onKillClick: (kill: KillAnalysis) => void
}) {
  const { counts, kills } = analysis
  const killListRef = useRef<HTMLDivElement>(null)

  // Scroll selected kill into view
  useEffect(() => {
    if (selectedKillIdx == null || !killListRef.current) return
    const btn = killListRef.current.querySelector(`[data-kill="${selectedKillIdx}"]`)
    btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedKillIdx])

  return (
    <div className="shrink-0 space-y-1.5">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-2 pl-2 pr-3.5">
        <div className="flex items-center gap-2 text-xs text-surface-muted-foreground">
          {counts.overshoot > 0 && (
            <span className="flex items-center gap-1">
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', CLASSIFICATION_STYLES.overshoot.dot)} />
              {counts.overshoot} overshoot
            </span>
          )}
          {counts.undershoot > 0 && (
            <span className="flex items-center gap-1">
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', CLASSIFICATION_STYLES.undershoot.dot)} />
              {counts.undershoot} undershoot
            </span>
          )}
          {counts.optimal > 0 && (
            <span className="flex items-center gap-1">
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', CLASSIFICATION_STYLES.optimal.dot)} />
              {counts.optimal} optimal
            </span>
          )}
          <span>·</span>
          <span>{fmtPct(analysis.avgEfficiency)} eff</span>
        </div>
        <div className="ml-auto">
          <InfoTooltip side="left">
            <div className="max-w-xs space-y-1.5 text-[11px]">
              <p className="font-medium text-popover-foreground">Mouse Path Analysis</p>
              <p className="text-popover-foreground/70">
                Classifies each kill's approach as overshoot, undershoot, or optimal by analyzing mouse movement patterns.
              </p>
              <div className="space-y-0.5 text-popover-foreground/70">
                <p><span className={CLASSIFICATION_STYLES.overshoot.text}>Overshoot</span> — cursor went past the target and corrected back</p>
                <p><span className={CLASSIFICATION_STYLES.undershoot.text}>Undershoot</span> — stopped short and made micro-corrections</p>
                <p><span className={CLASSIFICATION_STYLES.optimal.text}>Optimal</span> — direct path to target</p>
              </div>
              {analysis.avgOvershootPixels > 0 && (
                <p className="text-popover-foreground/70">Avg overshoot: {fmtNum(analysis.avgOvershootPixels)}px</p>
              )}
              {analysis.avgUndershootPixels > 0 && (
                <p className="text-popover-foreground/70">Avg undershoot: {fmtNum(analysis.avgUndershootPixels)}px</p>
              )}
              <p className="text-popover-foreground/50">Click a kill below to highlight its path.</p>
            </div>
          </InfoTooltip>
        </div>
      </div>

      {/* Sensitivity suggestion */}
      {suggestion && <SensSuggestionCard suggestion={suggestion} />}

      {/* Kill list — scrollable row */}
      <div ref={killListRef} className="scrollbar-compact flex gap-1 overflow-x-auto pb-0.5">
        {kills.map(k => (
          <KillChip
            key={k.killIdx}
            kill={k}
            selected={selectedKillIdx === k.killIdx}
            onClick={() => onKillClick(k)}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Kill chip ─── */

function KillChip({ kill, selected, onClick }: { kill: KillAnalysis; selected: boolean; onClick: () => void }) {
  const px = kill.classification === 'overshoot' ? kill.overshootPixels : kill.undershootPixels
  const style = CLASSIFICATION_STYLES[kill.classification]

  return (
    <button
      type="button"
      data-kill={kill.killIdx}
      onClick={onClick}
      title={`Kill #${kill.killIdx} — ${kill.classification}${px > 0 ? ` (${fmtNum(px, 0)}px)` : ''} — ${fmtPct(kill.efficiency)} eff`}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums transition-colors',
        selected ? 'bg-surface-muted text-foreground' : 'text-surface-muted-foreground hover:bg-surface-muted/50 hover:text-foreground',
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
      #{kill.killIdx}
    </button>
  )
}

/* ─── Sensitivity suggestion card ─── */

function SensSuggestionCard({ suggestion }: { suggestion: SensSuggestion }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.recommended.toFixed(2))
    } catch {
      // Fallback for unsupported environment
    }
  }

  return (
    <div className="rounded-xl bg-surface-subtle px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-surface-muted-foreground">Suggested sens</span>
          <span className="font-medium text-foreground">
            {fmtNum(suggestion.recommended, 2)} cm/360
          </span>
          <span className="text-[11px] text-surface-muted-foreground">
            ({suggestion.changePct >= 0 ? '+' : ''}{fmtNum(suggestion.changePct)}%)
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${suggestion.recommended.toFixed(2)}`}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-surface-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <InfoTooltip side="left">
          <div className="max-w-xs space-y-1 text-[11px]">
            <p className="font-medium text-popover-foreground">Training Sensitivity</p>
            <p className="text-popover-foreground/70">{suggestion.reason}</p>
          </div>
        </InfoTooltip>
      </div>
    </div>
  )
}

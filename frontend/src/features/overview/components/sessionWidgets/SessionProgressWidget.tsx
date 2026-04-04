import { InfoTooltip, Widget } from '@/shared/components'
import { usePersistedState } from '@/shared/hooks'
import { CHART_SERIES_COLORS, STORAGE_KEYS } from '@/shared/lib'
import type { RecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'

const PHASE_SWATCH = {
  warmup: 'var(--phase-warmup)',
  warmupFill: 'var(--phase-warmup-soft)',
  peak: 'var(--phase-peak)',
  peakFill: 'var(--phase-peak-soft)',
  diminishing: 'var(--phase-diminishing)',
  diminishingFill: 'var(--phase-diminishing-soft)',
} as const

export function SessionProgressWidget({ snapshot }: { snapshot: RecentSessionSnapshot }) {
  const {
    currentSession,
    currentRuns,
    suggestedRuns,
    warmupRuns,
    peakStart,
    peakEnd,
    diminishingReturnsAt,
  } = snapshot

  const [customTarget] = usePersistedState<number | null>(
    STORAGE_KEYS.overviewSessionProgressTargetRuns,
    null,
  )

  const targetRuns = customTarget ?? suggestedRuns

  if (!currentSession) {
    return (
      <Widget title="Session Progress">
        <div className="flex h-full items-center justify-center rounded-xl bg-surface-muted-strong p-4 text-sm text-surface-muted-foreground">
          Play or import a few runs to see session progress.
        </div>
      </Widget>
    )
  }

  const pct = targetRuns > 0
    ? Math.min(Math.round((currentRuns / targetRuns) * 100), 100)
    : 0

  const maxRun = Math.max(targetRuns, diminishingReturnsAt, currentRuns, 12)
  const toAngle = (run: number) => 90 - (Math.min(run, maxRun) / maxRun) * 360
  const warmupEnd = Math.min(warmupRuns, maxRun)
  const peakEndClamped = Math.min(peakEnd, maxRun)
  const dimEnd = Math.min(diminishingReturnsAt, maxRun)

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
    <Widget title="Session Progress">
      <div className="relative mx-auto flex flex-1 items-center justify-center">
        <div className="relative aspect-square w-full max-w-[160px] shrink-0">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="var(--surface-muted)" strokeWidth={outerR - innerR} />

            <path d={arcPath(0, warmupEnd)} fill={PHASE_SWATCH.warmupFill} />
            <path d={arcPath(peakStart - 1, peakEndClamped)} fill={PHASE_SWATCH.peakFill} />
            {dimEnd < maxRun && (
              <path d={arcPath(dimEnd, maxRun)} fill={PHASE_SWATCH.diminishingFill} />
            )}

            {currentRuns > 0 && (
              <path d={arcPath(0, currentRuns)} fill={CHART_SERIES_COLORS.scoreHistory} opacity={0.55} />
            )}

            <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
              {currentRuns}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className="fill-surface-muted-foreground text-[11px]">
              / {targetRuns} target
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle" className="fill-surface-muted-foreground text-[10px]">
              {pct}%
            </text>
          </svg>
        </div>

        <div className="absolute bottom-0 right-0">
          <InfoTooltip side="left">
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_SWATCH.warmup }} />
                <span className="text-popover-foreground/70">Warm-up</span>
                <span className="ml-auto font-medium text-popover-foreground">1–{warmupRuns}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_SWATCH.peak }} />
                <span className="text-popover-foreground/70">Peak</span>
                <span className="ml-auto font-medium text-popover-foreground">{peakStart}–{peakEnd}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_SWATCH.diminishing }} />
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

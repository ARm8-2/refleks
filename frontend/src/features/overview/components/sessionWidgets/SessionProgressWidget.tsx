import { InfoTooltip, Widget } from '@/shared/components'
import { usePersistedState } from '@/shared/hooks'
import { Minus, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'

const SESSION_TARGET_STORAGE_KEY = 'refleks.overview.sessionProgress.targetRuns'

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
            <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="var(--muted)" strokeWidth={outerR - innerR} />

            <path d={arcPath(0, warmupEnd)} fill="rgb(245 159 10 / 0.18)" />
            <path d={arcPath(peakStart - 1, peakEndClamped)} fill="rgb(16 183 127 / 0.18)" />
            {dimEnd < maxRun && (
              <path d={arcPath(dimEnd, maxRun)} fill="rgb(239 68 68 / 0.12)" />
            )}

            {currentRuns > 0 && (
              <path d={arcPath(0, currentRuns)} fill="var(--chart-2)" opacity={0.55} />
            )}

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

import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useChartTheme } from '../../hooks/useChartTheme'
import { colorWithAlpha } from '../../lib/theme'

type SessionProgressBarProps = {
  currentRuns: number
  targetRuns: number
  defaultTarget: number
  onTargetChange: (target: number) => void
  warmup: number
  peakStart: number
  peakEnd: number
  maxRuns: number
}

export function SessionProgressBar({
  currentRuns,
  targetRuns,
  defaultTarget,
  onTargetChange,
  warmup,
  peakStart,
  peakEnd,
  maxRuns
}: SessionProgressBarProps) {
  const palette = useChartTheme()
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isModified = targetRuns !== defaultTarget

  const warmupColor = colorWithAlpha(palette.warning, 0.3, 'rgba(245,158,11,0.3)')
  const peakColor = colorWithAlpha(palette.success, 0.4, 'rgba(16,185,129,0.4)')
  const progressColor = colorWithAlpha(palette.textPrimary, 0.2, 'rgba(255,255,255,0.2)')
  const targetColor = palette.accent

  const toPercent = (n: number) => Math.min(100, Math.max(0, (n / maxRuns) * 100))

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val > 0) {
      onTargetChange(val)
    }
  }

  return (
    <div className="flex items-center gap-3 w-full select-none group/bar">
      <div
        className="relative h-2 flex-grow rounded-full bg-surface-3 overflow-hidden"
      >
        {/* Zones Background */}
        <div
          className="absolute inset-y-0 left-0 transition-all"
          style={{ width: `${toPercent(warmup)}%`, backgroundColor: warmupColor }}
        />
        <div
          className="absolute inset-y-0 transition-all"
          style={{
            left: `${toPercent(peakStart - 1)}%`,
            width: `${toPercent(peakEnd - peakStart + 1)}%`,
            backgroundColor: peakColor,
          }}
        />

        {/* Current Progress Bar */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
          style={{
            width: `${toPercent(currentRuns)}%`,
            backgroundColor: progressColor,
          }}
        />
        {/* Current Progress Marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10 transition-all"
          style={{ left: `${toPercent(currentRuns)}%`, backgroundColor: palette.textPrimary }}
        />

        {/* Target Marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10 transition-all bg-accent shadow-[0_0_4px_rgba(0,0,0,0.5)]"
          style={{ left: `${toPercent(targetRuns)}%`, backgroundColor: targetColor }}
        />
      </div>

      {/* Count Display */}
      <div className="text-secondary whitespace-nowrap flex items-center justify-end gap-1.5">
        <span className="text-secondary font-medium">{currentRuns}</span>
        <span className="text-secondary">/</span>

        <div className="relative flex items-center gap-1">
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              className="w-12 px-1 py-0.5 rounded bg-surface-3 border border-primary text-primary text-xs text-center outline-none focus:border-accent"
              value={targetRuns}
              onChange={handleInputChange}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            />
          ) : (
            <span
              className="text-secondary cursor-pointer hover:text-accent hover:underline decoration-dashed underline-offset-2 transition-colors"
              onClick={() => setIsEditing(true)}
              title="Click to edit target"
            >
              {targetRuns}
            </span>
          )}

          <span className="text-secondary">runs</span>

          {isModified && !isEditing && (
            <button
              onClick={(e) => { e.stopPropagation(); onTargetChange(defaultTarget); }}
              className="text-secondary hover:text-primary transition-colors ml-1"
              title={`Reset to recommended (${defaultTarget})`}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { Coffee, TrendingDown, X } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { SessionAnalysis, SessionHealthLevel } from '../../lib/analysis/session'
import { formatDuration } from '../../lib/utils'
import type { Session } from '../../types/domain'

type FatigueAlertProps = {
  currentSession: Session | null
  analysis: SessionAnalysis
}

export function FatigueAlert({ currentSession, analysis }: FatigueAlertProps) {
  const isInSession = useStore(s => s.isInSession)
  const [dismissedAtRun, setDismissedAtRun] = useState<number | null>(null)

  // Reset dismissal if session changes
  if (currentSession && dismissedAtRun !== null && analysis.totalRuns < dismissedAtRun) {
    setDismissedAtRun(null)
  }

  // Check if currently dismissed (snoozed for 2 runs)
  const isSnoozed = dismissedAtRun !== null && analysis.totalRuns < dismissedAtRun + 2

  // Only show for declining or fatigued states
  if (!isInSession || analysis.healthLevel === 'optimal' || analysis.healthLevel === 'good' || isSnoozed) {
    return null
  }

  const config = getAlertConfig(analysis.healthLevel)

  return (
    <div
      className="relative p-4 rounded border animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        backgroundColor: `color-mix(in srgb, ${config.color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${config.color} 30%, transparent)`,
      }}
    >
      <button
        onClick={() => setDismissedAtRun(analysis.totalRuns)}
        className="absolute top-3 right-3 p-1 rounded hover:bg-hover text-secondary hover:text-primary transition-colors"
        title="Dismiss for now (remind me later)"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div
          className="flex-shrink-0 p-2 rounded"
          style={{ backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)` }}
        >
          <config.Icon size={18} style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-primary mb-1" style={{ color: config.color }}>
            {config.title}
          </div>

          <p className="text-sm text-primary mb-2">
            {analysis.healthMessage}
          </p>

          {/* Contextual details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
            <span>
              <span className="text-muted">Duration:</span>{' '}
              {formatDuration(analysis.durationMinutes * 60000) || '<1m'}
            </span>
            <span>
              <span className="text-muted">Runs:</span>{' '}
              {analysis.totalRuns}
            </span>
            {analysis.fatigueConfidence > 0.3 && (
              <span>
                <span className="text-muted">Confidence:</span>{' '}
                {Math.round(analysis.fatigueConfidence * 100)}%
              </span>
            )}
            {analysis.hasLearningCurveEffect && (
              <span className="text-muted italic">
                (learning curve may affect results)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getAlertConfig(level: SessionHealthLevel): {
  Icon: typeof Coffee
  title: string
  color: string
} {
  switch (level) {
    case 'fatigued':
      return {
        Icon: Coffee,
        title: 'Time for a Break',
        color: 'var(--error)',
      }
    case 'declining':
      return {
        Icon: TrendingDown,
        title: 'Performance Declining',
        color: 'var(--warning)',
      }
    default:
      return {
        Icon: TrendingDown,
        title: 'Heads Up',
        color: 'var(--warning)',
      }
  }
}

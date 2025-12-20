import { Activity, Clock, Gamepad2 } from 'lucide-react'
import { useUIState } from '../../hooks/useUIState'
import { SessionAnalysis, SessionHealthLevel, SessionLengthRecommendation } from '../../lib/analysis/session'
import { formatDuration } from '../../lib/utils'
import type { Session } from '../../types/domain'
import { SessionProgressBar } from './SessionProgressBar'

type SessionStatusProps = {
  currentSession: Session | null
  analysis: SessionAnalysis
  recommendation: SessionLengthRecommendation
}

export function SessionStatus({ currentSession, analysis, recommendation }: SessionStatusProps) {
  const [userTarget, setUserTarget] = useUIState<number | null>(`session:target`, null)
  const targetRuns = userTarget ?? recommendation.suggestedRuns

  if (!currentSession || currentSession.items.length === 0) {
    return null
  }

  const statusConfig = getStatusConfig(analysis.healthLevel, analysis.performanceTrend)

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 rounded border border-primary bg-surface-2 text-sm flex-1 min-w-[300px]">
      {/* Session health indicator */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: statusConfig.color }}
        />
        <span className="text-secondary">
          {statusConfig.label}
        </span>
      </div>

      <div className="h-4 border-l border-primary" />

      {/* Duration */}
      <div className="flex items-center gap-1.5 text-secondary" title="Session Duration">
        <Clock size={14} />
        <span>{formatDuration(analysis.durationMinutes * 60000) || '<1m'}</span>
      </div>

      {/* Playtime */}
      <div className="flex items-center gap-1.5 text-secondary" title="Playtime">
        <Gamepad2 size={18} />
        <span>{formatDuration(analysis.playtimeMinutes * 60000) || '<1m'}</span>
      </div>

      {/* Scenarios */}
      <div className="flex items-center gap-1.5 text-secondary">
        <Activity size={14} />
        <span>{analysis.uniqueScenarios} scenario{analysis.uniqueScenarios !== 1 ? 's' : ''}</span>
      </div>

      {/* Session Progress Bar (Right aligned) */}
      <div className="ml-auto flex-grow min-w-[200px]">
        <SessionProgressBar
          currentRuns={analysis.totalRuns}
          targetRuns={targetRuns}
          defaultTarget={recommendation.suggestedRuns}
          onTargetChange={setUserTarget}
          warmup={recommendation.warmupRuns}
          peakStart={recommendation.peakPerformanceWindow[0]}
          peakEnd={recommendation.peakPerformanceWindow[1]}
          maxRuns={Math.max(targetRuns + 5, recommendation.diminishingReturnsAt + 5, 20)}
        />
      </div>
    </div>
  )
}

function getStatusConfig(level: SessionHealthLevel, trend: number): { label: string; color: string } {
  switch (level) {
    case 'fatigued':
      return { label: 'Take a break', color: 'var(--error)' }
    case 'declining':
      return { label: 'Declining', color: 'var(--warning)' }
    case 'optimal':
      return { label: trend > 0.05 ? 'Improving' : 'Optimal', color: 'var(--success)' }
    case 'good':
    default:
      return { label: 'Active', color: 'var(--accent-primary)' }
  }
}

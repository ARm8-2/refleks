import { Activity, Clock, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { analyzeSessionHealth, buildScenarioProfiles, SessionHealthLevel } from '../../lib/analysis/sessionAnalysis'
import { formatDuration } from '../../lib/utils'
import type { Session } from '../../types/domain'

type SessionStatusProps = {
  currentSession: Session | null
  allSessions: Session[]
}

export function SessionStatus({ currentSession, allSessions }: SessionStatusProps) {
  const profiles = useMemo(() => buildScenarioProfiles(allSessions), [allSessions])
  const analysis = useMemo(
    () => analyzeSessionHealth(currentSession, allSessions, profiles),
    [currentSession, allSessions, profiles]
  )

  if (!currentSession || currentSession.items.length === 0) {
    return null
  }

  const statusConfig = getStatusConfig(analysis.healthLevel, analysis.performanceTrend)

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-sm">
      {/* Session health indicator */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: statusConfig.color }}
        />
        <span className="text-[var(--text-secondary)]">
          {statusConfig.label}
        </span>
      </div>

      <div className="h-4 w-px bg-[var(--border-primary)]" />

      {/* Duration */}
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <Clock size={14} />
        <span>{formatDuration(analysis.durationMinutes * 60000) || '<1m'}</span>
      </div>

      {/* Run count */}
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <Target size={14} />
        <span>{analysis.totalRuns} runs</span>
      </div>

      {/* Scenarios */}
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <Activity size={14} />
        <span>{analysis.uniqueScenarios} scenario{analysis.uniqueScenarios !== 1 ? 's' : ''}</span>
      </div>

      {/* Performance trend - only show if we have enough data */}
      {!analysis.hasInsufficientData && (
        <>
          <div className="h-4 w-px bg-[var(--border-primary)]" />
          <TrendIndicator trend={analysis.performanceTrend} />
        </>
      )}
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

function TrendIndicator({ trend }: { trend: number }) {
  const isPositive = trend > 0.03
  const isNegative = trend < -0.03

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus
  const color = isPositive ? 'var(--success)' : isNegative ? 'var(--error)' : 'var(--text-muted)'
  const label = isPositive ? 'Improving' : isNegative ? 'Declining' : 'Stable'

  return (
    <div className="flex items-center gap-1.5" style={{ color }}>
      <Icon size={14} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

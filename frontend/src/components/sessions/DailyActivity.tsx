import { Calendar, Flame } from 'lucide-react'
import { useMemo } from 'react'
import { calculateDailyActivity } from '../../lib/analysis/activity'
import { formatDuration } from '../../lib/utils'
import type { Session } from '../../types/domain'

type DailyActivityProps = {
  currentSession: Session | null
  allSessions: Session[]
}

export function DailyActivity({ currentSession, allSessions }: DailyActivityProps) {
  const stats = useMemo(() => calculateDailyActivity(currentSession, allSessions), [currentSession, allSessions])

  if (!currentSession) return null

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 rounded border border-primary bg-surface-2 text-sm shrink-0">
      {/* Daily Streak */}
      <div className="flex items-center gap-1 text-secondary" title="Daily Streak">
        <Flame size={16} className={stats.streak > 0 ? "text-streak" : ""} />
        <span>{stats.streak}</span>
      </div>

      <div className="h-4 border-l border-primary" />

      {/* Daily Playtime */}
      <div className="flex items-center gap-1.5 text-secondary" title="Total Playtime on this day">
        <Calendar size={14} />
        <span>{formatDuration(stats.playtimeMs)} today</span>
      </div>
    </div>
  )
}

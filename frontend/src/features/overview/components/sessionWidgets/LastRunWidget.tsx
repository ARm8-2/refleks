import { Widget } from '@/shared/components'
import { Activity, Crosshair } from 'lucide-react'
import { useRecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { EmptyMetricWidget, formatScore, TrendIndicator } from './shared'

export function LastRunWidget() {
  const { currentSession, lastRunScore, lastRunAccuracy, lastRunScoreTrend, lastRunAccTrend, lastRunScenario, recentScores } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Activity} label="Last Run" />

  if (lastRunScore === null && lastRunAccuracy === null) {
    return (
      <Widget
        title={<span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Last Run</span>}
        className="px-4 py-3"
      >
        <div className="text-lg font-semibold text-surface-muted-foreground">--</div>
        <div className="mt-0.5 text-xs text-surface-muted-foreground">No score data</div>
      </Widget>
    )
  }

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Last Run</span>}
      className="px-4 py-3"
      headerActions={
        lastRunScenario ? <span className="max-w-[120px] truncate text-[11px] text-surface-muted-foreground" title={lastRunScenario}>{lastRunScenario}</span> : null
      }
    >
      <div className="flex items-center gap-4">
        {lastRunScore !== null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-foreground">{formatScore(lastRunScore)}</span>
            <TrendIndicator trend={lastRunScoreTrend} />
          </div>
        )}
        {lastRunAccuracy !== null && (
          <div className="flex items-baseline gap-1.5">
            <Crosshair className="h-3 w-3 text-surface-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{lastRunAccuracy.toFixed(1)}%</span>
            <TrendIndicator trend={lastRunAccTrend} />
          </div>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-surface-muted-foreground">
        <span>{lastRunScoreTrend !== null ? 'Trend: last 40% vs first 60%' : 'Score & accuracy'}</span>
        {recentScores.length > 0 && <span className="ml-auto tabular-nums">{recentScores.length} {recentScores.length === 1 ? 'run' : 'runs'}</span>}
      </div>
    </Widget>
  )
}

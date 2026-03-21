import { Widget } from '@/shared/components'
import { cn } from '@/shared/lib'
import { Gauge } from 'lucide-react'
import { useRecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { EmptyMetricWidget, getPerformanceAccent, getStatusIcon, getToneBadgeClasses } from './shared'

export function SessionPerformanceWidget() {
  const { currentSession, statusTone, performanceValue, performanceDetail, statusLabel } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Gauge} label="Performance" />

  const StatusIcon = getStatusIcon(statusTone)

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Gauge className={cn('h-3.5 w-3.5', getPerformanceAccent(statusTone))} />Performance</span>}
      className="px-4 py-3"
      headerActions={
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', getToneBadgeClasses(statusTone))}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>
      }
    >
      <div className={cn('text-lg font-semibold', getPerformanceAccent(statusTone))}>{performanceValue}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{performanceDetail}</div>
    </Widget>
  )
}

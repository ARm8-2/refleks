import { Widget } from '@/shared/components'
import { Clock3, Gamepad2 } from 'lucide-react'
import { useRecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { EmptyMetricWidget } from './shared'

export function SessionTimeWidget() {
  const { currentSession, sessionLengthLabel, sessionLengthDetail, activePlaytimeLabel, activePlaytimeDetail } = useRecentSessionSnapshot()
  if (!currentSession) return <EmptyMetricWidget icon={Clock3} label="Session & Playtime" />

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Session & Playtime</span>}
      className="px-4 py-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-foreground">{sessionLengthLabel}</span>
        <span className="text-xs text-surface-muted-foreground">{sessionLengthDetail}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <Gamepad2 className="h-3 w-3 text-surface-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{activePlaytimeLabel}</span>
        <span className="text-xs text-surface-muted-foreground">{activePlaytimeDetail}</span>
      </div>
    </Widget>
  )
}

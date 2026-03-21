import { getScenarioTrace } from '@/shared/lib'
import type { MousePoint } from '@/shared/types/ipc'
import { useEffect, useState } from 'react'
import { decodeTrace } from '../../lib/decodeTrace'
import type { HistoryRun } from '../../lib/historyModels'
import { TraceReplay } from '../TraceReplay'

function useTraceData(run: HistoryRun | null) {
  const [points, setPoints] = useState<MousePoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasTrace = !!run && !!run.item.hasTrace
  const fileName = run?.item.fileName ?? null
  const flagHasTrace = run?.item.hasTrace ?? false

  useEffect(() => {
    setPoints(null)
    setError(null)
    if (!flagHasTrace || !fileName) return

    let cancelled = false
    setLoading(true)
    getScenarioTrace(fileName)
      .then(b64 => {
        if (cancelled) return
        const decoded = decodeTrace(b64)
        setPoints(decoded.length > 0 ? decoded : null)
        if (decoded.length === 0) setError('Trace file was empty')
      })
      .catch(() => { if (!cancelled) setError('Failed to load trace data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fileName, flagHasTrace])

  return { points, loading, error, hasTrace, resolution: String(run?.item.stats?.Resolution ?? '') }
}

export function TraceTab({ primaryRun, compareRun, overlay }: { primaryRun: HistoryRun; compareRun: HistoryRun | null; overlay: boolean }) {
  const primary = useTraceData(primaryRun)
  const compare = useTraceData(compareRun)

  if (!primary.hasTrace) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">No mouse trace data. Enable mouse tracking in settings to record traces.</p>
      </div>
    )
  }

  if (primary.loading || compare.loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading trace…</p>
      </div>
    )
  }

  if (primary.error || !primary.points || primary.points.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">{primary.error ?? 'No trace data available'}</p>
      </div>
    )
  }

  const hasCompare = compare.points != null && compare.points.length > 0

  return (
    <div className="min-h-0 flex-1">
      <TraceReplay
        points={primary.points}
        resolution={primary.resolution || undefined}
        comparePoints={hasCompare ? compare.points! : undefined}
        compareResolution={hasCompare ? (compare.resolution || undefined) : undefined}
        layout={hasCompare && !overlay ? 'split' : 'overlay'}
      />
    </div>
  )
}

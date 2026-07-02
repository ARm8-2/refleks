import { getRunPerformanceEvents } from '@/shared/lib/api'
import type { RunPerformanceEvent } from '@/shared/types/ipc'
import { useEffect, useState } from 'react'
import type { HistoryRun } from '../lib/historyModels'

// Lazily load the v2 performance events for a run from local storage.
export function useRunPerformanceEvents(run: HistoryRun | null): RunPerformanceEvent[] | null {
  const [events, setEvents] = useState<RunPerformanceEvent[] | null>(null)

  useEffect(() => {
    if (!run) {
      setEvents(null)
      return
    }

    const filePath = run.item.filePath
    if (!filePath) {
      setEvents(null)
      return
    }

    let cancelled = false
    setEvents(null)

    getRunPerformanceEvents(filePath)
      .then(result => {
        if (cancelled) return
        setEvents(result)
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })

    return () => { cancelled = true }
  }, [run?.item.filePath])

  return events
}

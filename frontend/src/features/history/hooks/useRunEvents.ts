import { getRunEvents } from '@/shared/lib/api'
import { useEffect, useState } from 'react'
import type { HistoryRun } from '../lib/historyModels'

/**
 * Lazily loads kill events for a run from local storage.
 * Bulk history data strips events to stay memory-efficient, so inspector views
 * read them back from disk on demand.
 */
export function useRunEvents(run: HistoryRun | null): string[][] | null {
  const [events, setEvents] = useState<string[][] | null>(null)

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

    getRunEvents(filePath)
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

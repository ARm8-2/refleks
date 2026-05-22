import { getRunStatsEvents } from '@/shared/lib/api'
import { useEffect, useState } from 'react'
import type { HistoryRun } from '../lib/historyModels'

// Lazily load the CSV-derived stats events for a run from local storage.
export function useRunStatsEvents(run: HistoryRun | null): string[][] | null {
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

    getRunStatsEvents(filePath)
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

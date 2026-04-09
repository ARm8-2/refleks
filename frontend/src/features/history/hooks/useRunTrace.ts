import { getRunTrace } from '@/shared/lib/api'
import type { MousePoint } from '@/shared/types/ipc'
import { useEffect, useState } from 'react'
import { decodeTrace } from '../lib/decodeTrace'
import type { HistoryRun } from '../lib/historyModels'

/**
 * Lazily loads mouse trace data for a run from local storage.
 * Like events, traces are fetched from disk on demand instead of being held in
 * bulk run history state.
 */
export function useRunTrace(run: HistoryRun | null): MousePoint[] | null {
  const [points, setPoints] = useState<MousePoint[] | null>(null)

  useEffect(() => {
    if (!run) {
      setPoints(null)
      return
    }

    const filePath = run.item.filePath
    if (!filePath) {
      setPoints(null)
      return
    }

    let cancelled = false
    setPoints(null)

    getRunTrace(filePath)
      .then(encoded => {
        if (cancelled) return
        if (!encoded) {
          setPoints([])
          return
        }

        const decoded = decodeTrace(encoded)
        setPoints(decoded)
      })
      .catch(() => {
        if (!cancelled) setPoints([])
      })

    return () => { cancelled = true }
  }, [run?.item.filePath])

  return points
}

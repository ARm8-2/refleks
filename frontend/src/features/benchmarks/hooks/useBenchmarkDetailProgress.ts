import { usePersistedState } from '@/shared/hooks'
import { getBenchmarkProgress } from '@/shared/lib'
import type { Benchmark, BenchmarkProgress } from '@/shared/types'
import { EventsOn } from '@wails/runtime'
import { useEffect, useMemo, useState } from 'react'

type State = {
  progress: BenchmarkProgress | null
  loading: boolean
  error: string | null
  difficultyIndex: number
  setDifficultyIndex: (value: number) => void
}

export function useBenchmarkDetailProgress(benchmark: Benchmark | undefined): State {
  const benchmarkName = benchmark?.benchmarkName ?? 'unknown'
  const [difficultyIndex, setDifficultyIndex] = usePersistedState<number>(
    `refleks.benchmarks.detail.${benchmarkName}.difficulty`,
    0,
  )

  const [progress, setProgress] = useState<BenchmarkProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxIndex = Math.max(0, (benchmark?.difficulties?.length ?? 1) - 1)
  const safeIndex = Math.max(0, Math.min(maxIndex, difficultyIndex))

  useEffect(() => {
    if (safeIndex !== difficultyIndex) setDifficultyIndex(safeIndex)
  }, [difficultyIndex, safeIndex, setDifficultyIndex])

  const selectedDifficulty = useMemo(
    () => benchmark?.difficulties?.[safeIndex],
    [benchmark, safeIndex],
  )

  useEffect(() => {
    const benchmarkId = selectedDifficulty?.kovaaksBenchmarkId
    if (!benchmarkId) {
      setProgress(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const refreshProgress = async () => {
      try {
        const nextProgress = await getBenchmarkProgress(benchmarkId)
        if (cancelled) return
        setProgress(nextProgress)
        setError(null)
      } catch (refreshError) {
        if (cancelled) return
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
      }
    }

    setLoading(true)
    refreshProgress().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const offRealtime = EventsOn('benchmark:progress:updated', (data: any) => {
      if (cancelled || !data || data.id !== benchmarkId || !data.progress) return
      setProgress(data.progress as BenchmarkProgress)
      setError(null)
    })

    const triggerRefresh = () => {
      if (cancelled) return
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        void refreshProgress()
      }, 700)
    }

    const offScenarioAdded = EventsOn('scenario:added', () => triggerRefresh())
    const offScenarioUpdated = EventsOn('scenario:updated', () => triggerRefresh())

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)

      try { offRealtime() } catch { }
      try { offScenarioAdded() } catch { }
      try { offScenarioUpdated() } catch { }
    }
  }, [selectedDifficulty])

  return {
    progress,
    loading,
    error,
    difficultyIndex: safeIndex,
    setDifficultyIndex,
  }
}

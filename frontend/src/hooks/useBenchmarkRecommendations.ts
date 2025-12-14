import { useMemo } from 'react'
import { getBenchmarkRecommendations } from '../lib/benchmarks/recommendations'
import type { BenchmarkListItem } from '../types/domain'
import type { Benchmark, BenchmarkProgress } from '../types/ipc'
import { useStore } from './useStore'

export function useBenchmarkRecommendations(
  items: BenchmarkListItem[],
  benchmarksById: Record<string, Benchmark>,
  progressMap: Record<number, BenchmarkProgress>,
  enabled: boolean
) {
  const sessions = useStore(s => s.sessions)

  return useMemo(() => {
    if (!enabled) return []
    return getBenchmarkRecommendations(items, benchmarksById, progressMap, sessions)
  }, [items, benchmarksById, progressMap, enabled, sessions])
}

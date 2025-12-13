import { useMemo } from 'react'
import { models } from '../../wailsjs/go/models'
import { getBenchmarkRecommendations } from '../lib/benchmarks/recommendations'
import type { BenchmarkListItem } from '../types/domain'
import type { Benchmark } from '../types/ipc'
import { useStore } from './useStore'

export function useBenchmarkRecommendations(
  items: BenchmarkListItem[],
  benchmarksById: Record<string, Benchmark>,
  progressMap: Record<number, models.BenchmarkProgress>,
  enabled: boolean
) {
  const sessions = useStore(s => s.sessions)

  return useMemo(() => {
    if (!enabled) return []
    return getBenchmarkRecommendations(items, benchmarksById, progressMap, sessions)
  }, [items, benchmarksById, progressMap, enabled, sessions])
}

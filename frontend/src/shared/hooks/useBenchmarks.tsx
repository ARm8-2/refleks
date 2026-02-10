import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { EventsOn } from '../../../wailsjs/runtime'
import {
  getAllBenchmarkProgresses,
  getBenchmarkProgress,
  getBenchmarks,
  getFavoriteBenchmarks,
  refreshAllBenchmarkProgresses,
  setFavoriteBenchmarks,
} from '../lib/api'
import type { Benchmark, BenchmarkProgress } from '../types/ipc'

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface BenchmarkState {
  /** Full list of available benchmarks (loaded once on mount). */
  benchmarks: Benchmark[]
  /** Favorite benchmark names. */
  favorites: string[]
  /** Cached progress data keyed by Kovaak's numeric benchmark ID. */
  progressMap: Record<number, BenchmarkProgress>
  /** Whether initial data is still loading. */
  loading: boolean
  /** Currently selected benchmark name (persists across page navigations). */
  selectedBenchmark: string | null

  // Actions
  selectBenchmark: (name: string | null) => void
  toggleFavorite: (name: string) => void
  isFavorite: (name: string) => boolean
  getProgress: (kovaaksBenchmarkId: number) => BenchmarkProgress | undefined
  loadProgress: (kovaaksBenchmarkId: number) => Promise<BenchmarkProgress | undefined>
  loadAllProgress: () => Promise<void>
  refreshAllProgress: () => Promise<void>

  // Lookup
  getBenchmarkByName: (name: string) => Benchmark | undefined
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const BenchmarkCtx = createContext<BenchmarkState | null>(null)

export function BenchmarkProvider({ children }: { children: ReactNode }) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [progressMap, setProgressMap] = useState<Record<number, BenchmarkProgress>>({})
  const [loading, setLoading] = useState(true)
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null)

  // Derived: fast lookup by benchmarkName (unique)
  const benchmarkIndex = useMemo(() => {
    const map = new Map<string, Benchmark>()
    for (const b of benchmarks) map.set(b.benchmarkName, b)
    return map
  }, [benchmarks])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getBenchmarks().catch(() => [] as Benchmark[]),
      getFavoriteBenchmarks().catch(() => [] as string[]),
    ]).then(([list, favs]) => {
      if (cancelled) return
      setBenchmarks(list)
      setFavorites(favs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // ---- Real-time progress updates from Go backend ----
  useEffect(() => {
    const off = EventsOn('benchmark:progress:updated', (data: any) => {
      if (data && typeof data.id === 'number' && data.progress) {
        setProgressMap(prev => ({ ...prev, [data.id]: data.progress }))
      }
    })
    return () => { try { off() } catch { /* ignore */ } }
  }, [])

  // ---- Actions ----

  const selectBenchmark = useCallback((name: string | null) => {
    setSelectedBenchmark(name)
  }, [])

  const toggleFavorite = useCallback((name: string) => {
    setFavorites(prev => {
      const next = prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
      setFavoriteBenchmarks(next).catch(console.error)
      return next
    })
  }, [])

  const isFavorite = useCallback((name: string) => favoriteSet.has(name), [favoriteSet])

  const getProgress = useCallback(
    (kovaaksBenchmarkId: number) => progressMap[kovaaksBenchmarkId],
    [progressMap],
  )

  const loadProgress = useCallback(async (kovaaksBenchmarkId: number) => {
    try {
      const progress = await getBenchmarkProgress(kovaaksBenchmarkId)
      setProgressMap(prev => ({ ...prev, [kovaaksBenchmarkId]: progress }))
      return progress
    } catch {
      return undefined
    }
  }, [])

  const loadAllProgress = useCallback(async () => {
    try {
      const all = await getAllBenchmarkProgresses()
      setProgressMap(prev => ({ ...prev, ...all }))
    } catch (e) {
      console.error('Failed to load all benchmark progresses:', e)
    }
  }, [])

  const refreshAllProgress = useCallback(async () => {
    try {
      const all = await refreshAllBenchmarkProgresses()
      setProgressMap(all)
    } catch (e) {
      console.error('Failed to refresh benchmark progresses:', e)
    }
  }, [])

  const getBenchmarkByName = useCallback(
    (name: string) => benchmarkIndex.get(name),
    [benchmarkIndex],
  )

  // ---- Memoised context value ----

  const value = useMemo<BenchmarkState>(() => ({
    benchmarks,
    favorites,
    progressMap,
    loading,
    selectedBenchmark,
    selectBenchmark,
    toggleFavorite,
    isFavorite,
    getProgress,
    loadProgress,
    loadAllProgress,
    refreshAllProgress,
    getBenchmarkByName,
  }), [
    benchmarks, favorites, progressMap, loading, selectedBenchmark,
    selectBenchmark, toggleFavorite, isFavorite, getProgress, loadProgress,
    loadAllProgress, refreshAllProgress, getBenchmarkByName,
  ])

  return <BenchmarkCtx.Provider value={value}>{children}</BenchmarkCtx.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBenchmarks(): BenchmarkState {
  const ctx = useContext(BenchmarkCtx)
  if (!ctx) throw new Error('BenchmarkProvider missing')
  return ctx
}

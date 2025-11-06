import { useEffect, useMemo, useState } from 'react'
import { EventsOn } from '../../wailsjs/runtime'
import { getBenchmarkProgress, getBenchmarks } from '../lib/internal'
import type { Benchmark, BenchmarkProgress } from '../types/ipc'
import { useUIState } from './useUIState'

export function useOpenedBenchmarkProgress(input?: { id?: string | null; bench?: Benchmark | null }) {
  const resolvedId = input?.id ?? null
  const [benchDifficultyIdx, setBenchDifficultyIdx] = useUIState<number>(`Benchmark:${resolvedId ?? ''}:difficultyIdx`, 0)

  const [bench, setBench] = useState<Benchmark | null>(input?.bench ?? null)
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve selected benchmark object when id changes
  useEffect(() => {
    let cancelled = false
    if (input?.bench) {
      setBench(input.bench)
      return () => { cancelled = true }
    }
    setBench(null)
    if (!resolvedId) { setLoading(false); return }
    // Indicate loading while we resolve the benchmark and then fetch progress
    setLoading(true)
    getBenchmarks()
      .then((list) => {
        if (cancelled) return
        const mapId = (b: Benchmark) => `${b.abbreviation}-${b.benchmarkName}`
        const found = list.find(b => mapId(b) === resolvedId) || null
        setBench(found)
      })
      .catch(() => { if (!cancelled) setBench(null) })
    return () => { cancelled = true }
  }, [input?.bench, resolvedId])

  // Load progress for the resolved benchmark + difficulty index
  useEffect(() => {
    let cancelled = false
    setProgress(null)
    setError(null)
    if (!bench || !bench.difficulties?.length) return
    const idx = Math.min(Math.max(0, benchDifficultyIdx), bench.difficulties.length - 1)
    const did = bench.difficulties[idx]?.kovaaksBenchmarkId
    if (!did) return
    setLoading(true)
    getBenchmarkProgress(did)
      .then((data) => { if (!cancelled) setProgress(data) })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bench, benchDifficultyIdx])

  // Live refresh: when scenarios are added/updated, re-fetch the current difficulty's progress
  useEffect(() => {
    if (!bench || !bench.difficulties?.length) return
    const idx = Math.min(Math.max(0, benchDifficultyIdx), bench.difficulties.length - 1)
    const did = bench.difficulties[idx]?.kovaaksBenchmarkId
    if (!did) return
    let cancelled = false
    let t: any = null

    const refresh = () => {
      if (cancelled) return
      getBenchmarkProgress(did)
        .then((data) => { if (!cancelled) setProgress(data) })
        .catch((e) => { if (!cancelled) setError(String(e?.message || e)) })
    }

    const trigger = () => {
      if (cancelled) return
      if (t) clearTimeout(t)
      t = setTimeout(refresh, 700)
    }

    const offAdd = EventsOn('ScenarioAdded', () => trigger())
    const offUpd = EventsOn('ScenarioUpdated', () => trigger())

    return () => {
      cancelled = true
      if (t) clearTimeout(t)
      try { offAdd() } catch { /* ignore */ }
      try { offUpd() } catch { /* ignore */ }
    }
  }, [bench, benchDifficultyIdx])

  const difficulty = useMemo(() => (
    bench?.difficulties?.[Math.min(Math.max(0, benchDifficultyIdx), Math.max(0, (bench?.difficulties?.length || 1) - 1))] || null
  ), [bench, benchDifficultyIdx])

  return {
    selectedBenchId: resolvedId ?? null,
    bench,
    difficultyIndex: benchDifficultyIdx,
    setDifficultyIndex: (v: number) => setBenchDifficultyIdx(v),
    difficulty,
    progress,
    loading,
    error,
  }
}

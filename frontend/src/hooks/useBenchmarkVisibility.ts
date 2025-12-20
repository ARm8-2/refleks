import { useMemo } from 'react'
import { autoHiddenRanks } from '../lib/benchmarks/visibility'
import type { BenchmarkProgress } from '../types/ipc'
import { usePageState } from './usePageState'

export function useBenchmarkVisibility(progress: BenchmarkProgress | null) {
  const rankDefs = progress?.ranks || []
  const categories = progress?.categories || []

  const [autoHideCleared, setAutoHideCleared] = usePageState<boolean>('bench:visibility:autoHide', false)
  const [visibleRankCount, setVisibleRankCount] = usePageState<number>('bench:visibility:count', 4)

  // Store manually hidden indices as array for JSON serialization
  const [manuallyHiddenArr, setManuallyHiddenArr] = usePageState<number[]>('bench:visibility:manual', [])

  const manuallyHidden = useMemo(() => new Set(manuallyHiddenArr), [manuallyHiddenArr])

  // Flatten all scenarios visible in this benchmark view
  const allScenarios = useMemo(() => {
    const list: Array<{ scenarioRank: number }> = []
    if (!categories) return list
    for (const { groups } of categories) {
      for (const g of groups) {
        for (const s of g.scenarios) list.push({ scenarioRank: Number(s.scenarioRank || 0) })
      }
    }
    return list
  }, [categories])

  // Auto-hide any rank where ALL scenarios have surpassed that rank
  const autoHidden = useMemo(() => {
    const n = rankDefs.length
    const ranksArr = allScenarios.map(s => Number(s.scenarioRank || 0))
    return autoHiddenRanks(n, ranksArr, autoHideCleared, visibleRankCount)
  }, [rankDefs.length, allScenarios, autoHideCleared, visibleRankCount])

  // Combine manual + auto hidden sets
  const effectiveHidden = useMemo(() => {
    const out = new Set<number>()
    manuallyHidden.forEach(i => out.add(i))
    autoHidden.forEach(i => out.add(i))
    return out
  }, [manuallyHidden, autoHidden])

  // Compute the visible rank indices
  const visibleRankIndices = useMemo(() => {
    const n = rankDefs.length
    const all = Array.from({ length: n }, (_, i) => i)
    let vis = all.filter(i => !effectiveHidden.has(i))
    if (vis.length === 0 && n > 0) vis = [n - 1]
    return vis
  }, [rankDefs.length, effectiveHidden])

  const toggleManualRank = (idx: number) => {
    setManuallyHiddenArr(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return Array.from(next)
    })
  }
  const resetManual = () => setManuallyHiddenArr([])

  return {
    rankDefs,
    categories,
    autoHideCleared, setAutoHideCleared,
    manuallyHidden, toggleManualRank, resetManual,
    visibleRankCount, setVisibleRankCount,
    autoHidden,
    visibleRankIndices,
    visibleRanks: visibleRankIndices.map(i => rankDefs[i])
  }
}

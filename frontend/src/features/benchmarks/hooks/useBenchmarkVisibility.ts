import { usePersistedState } from '@/shared/hooks'
import { benchmarkDetailVisibilityStorageKey } from '@/shared/lib'
import type { BenchmarkProgress } from '@/shared/types'
import { useMemo } from 'react'
import { autoHiddenRanks } from '../lib/detailVisibility'

type Options = {
  storagePrefix: string
  progress: BenchmarkProgress | null
}

const DEFAULT_VISIBLE_RANK_COUNT = 4

export function useBenchmarkVisibility({ storagePrefix, progress }: Options) {
  const rankDefs = progress?.ranks || []
  const categories = progress?.categories || []

  const [autoHideCleared, setAutoHideCleared] = usePersistedState<boolean>(benchmarkDetailVisibilityStorageKey(storagePrefix, 'autoHide'), false)
  const [visibleRankCount, setVisibleRankCount] = usePersistedState<number>(benchmarkDetailVisibilityStorageKey(storagePrefix, 'visibleCount'), DEFAULT_VISIBLE_RANK_COUNT)
  const [manuallyHiddenArray, setManuallyHiddenArray] = usePersistedState<number[]>(benchmarkDetailVisibilityStorageKey(storagePrefix, 'manualHidden'), [])

  const manuallyHidden = useMemo(() => new Set(manuallyHiddenArray), [manuallyHiddenArray])

  const allScenarioRanks = useMemo(() => {
    const ranks: number[] = []
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          ranks.push(Number(scenario.scenarioRank || 0))
        }
      }
    }
    return ranks
  }, [categories])

  const autoHidden = useMemo(
    () => autoHiddenRanks(rankDefs.length, allScenarioRanks, autoHideCleared, visibleRankCount),
    [rankDefs.length, allScenarioRanks, autoHideCleared, visibleRankCount],
  )

  const effectiveHidden = useMemo(() => {
    const hidden = new Set<number>()
    manuallyHidden.forEach(index => hidden.add(index))
    autoHidden.forEach(index => hidden.add(index))
    return hidden
  }, [manuallyHidden, autoHidden])

  const visibleRankIndices = useMemo(() => {
    const allIndices = Array.from({ length: rankDefs.length }, (_, index) => index)
    let visible = allIndices.filter(index => !effectiveHidden.has(index))
    if (!visible.length && rankDefs.length > 0) visible = [rankDefs.length - 1]
    return visible
  }, [rankDefs.length, effectiveHidden])

  const toggleManualRank = (index: number) => {
    setManuallyHiddenArray(previous => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return Array.from(next)
    })
  }

  const resetManual = () => setManuallyHiddenArray([])

  return {
    rankDefs,
    categories,
    autoHideCleared,
    setAutoHideCleared,
    visibleRankCount,
    setVisibleRankCount,
    manuallyHidden,
    toggleManualRank,
    resetManual,
    autoHidden,
    visibleRankIndices,
    visibleRanks: visibleRankIndices.map(index => rankDefs[index]),
  }
}

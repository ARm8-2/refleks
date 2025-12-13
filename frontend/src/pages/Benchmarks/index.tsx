import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUIState } from '../../hooks/useUIState'
import { getBenchmarks, getFavoriteBenchmarks, setFavoriteBenchmarks } from '../../lib/internal'
import type { BenchmarkListItem } from '../../types/domain'
import type { Benchmark } from '../../types/ipc'
import { BenchmarksDetail } from './BenchmarksDetail'
import { BenchmarksExplore } from './BenchmarksExplore'

export function BenchmarksPage() {
  const [sp, setSp] = useSearchParams()
  const selected = sp.get('b') || null
  const [openBenchId, setOpenBenchId] = useUIState<string | null>('global:openBenchmark', null)

  const { items, byId, loading, favorites, toggleFavorite } = useBenchmarkData()

  // Sync URL and State
  useEffect(() => {
    if (selected && selected !== openBenchId) setOpenBenchId(selected)
  }, [selected, openBenchId, setOpenBenchId])

  useEffect(() => {
    if (!selected && openBenchId) {
      const params = new URLSearchParams(sp)
      params.set('b', openBenchId)
      setSp(params, { replace: true })
    }
  }, [selected, openBenchId, setSp, sp])

  const handleOpen = (id: string) => {
    setOpenBenchId(id)
    setSp({ b: id })
  }

  const handleBack = () => {
    const p = new URLSearchParams(sp)
    p.delete('b')
    setSp(p)
    setOpenBenchId(null)
  }

  if (selected) {
    return (
      <BenchmarksDetail
        id={selected}
        bench={byId[selected]}
        favorites={favorites}
        onToggleFav={toggleFavorite}
        onBack={handleBack}
      />
    )
  }

  return (
    <BenchmarksExplore
      items={items}
      favorites={favorites}
      loading={loading}
      onToggleFav={toggleFavorite}
      onOpen={handleOpen}
      benchmarksById={byId}
    />
  )
}

function useBenchmarkData() {
  const [items, setItems] = useState<BenchmarkListItem[]>([])
  const [byId, setById] = useState<Record<string, Benchmark>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    Promise.all([getBenchmarks(), getFavoriteBenchmarks()])
      .then(([list, favs]) => {
        if (!isMounted) return

        const mapped: BenchmarkListItem[] = list.map(b => ({
          id: `${b.abbreviation}-${b.benchmarkName}`,
          title: b.benchmarkName,
          abbreviation: b.abbreviation,
          subtitle: b.rankCalculation,
          color: b.color,
          dateAdded: b.dateAdded,
        }))

        const map: Record<string, Benchmark> = {}
        for (const b of list) {
          map[`${b.abbreviation}-${b.benchmarkName}`] = b
        }

        setItems(mapped)
        setById(map)
        setFavorites(favs)
        setLoading(false)
      })
      .catch(err => {
        console.warn('Failed to load benchmarks data', err)
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  const toggleFavorite = async (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]
    setFavorites(next)
    try { await setFavoriteBenchmarks(next) } catch (e) { console.warn('setFavoriteBenchmarks failed', e) }
  }

  return { items, byId, loading, favorites, toggleFavorite }
}

export default BenchmarksPage

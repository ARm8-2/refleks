import { Camera, ChevronLeft, Play, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BenchmarkCard, Dropdown, Tabs } from '../../components'
import ShareBenchmarkProgress from '../../components/benchmarks/ShareBenchmarkProgress'
import { useOpenedBenchmarkProgress } from '../../hooks/useOpenedBenchmarkProgress'
import { usePageState } from '../../hooks/usePageState'
import { useUIState } from '../../hooks/useUIState'
import { copyNodeToClipboard } from '../../lib/copyNodeToClipboard'
import { getBenchmarks, getFavoriteBenchmarks, launchPlaylist, setFavoriteBenchmarks } from '../../lib/internal'
import { DEFAULT_BENCHMARK_CATEGORY, getBenchmarkCategory } from '../../lib/utils'
import type { Benchmark } from '../../types/ipc'
import { AiTab, AnalysisTab, OverviewTab } from './tabs'

type BenchItem = { id: string; title: string; abbreviation: string; subtitle?: string; color?: string; dateAdded?: string }

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
        bench={byId[selected]}
        id={selected}
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
    />
  )
}

function useBenchmarkData() {
  const [items, setItems] = useState<BenchItem[]>([])
  const [byId, setById] = useState<Record<string, Benchmark>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    Promise.all([getBenchmarks(), getFavoriteBenchmarks()])
      .then(([list, favs]) => {
        if (!isMounted) return

        const mapped: BenchItem[] = list.map(b => ({
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

function useBenchmarkList(items: BenchItem[], favorites: string[]) {
  const [query, setQuery] = usePageState<string>('explore:query', '')
  const [showFavOnly, setShowFavOnly] = usePageState<boolean>('explore:showFavOnly', false)
  const [sortBy, setSortBy] = usePageState<'name' | 'abbr' | 'date'>('explore:sortBy', 'abbr')
  const [groupBy, setGroupBy] = usePageState<'none' | 'abbr' | 'category'>('explore:groupBy', 'category')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items
    if (q) {
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.abbreviation.toLowerCase().includes(q) ||
        (i.subtitle ?? '').toLowerCase().includes(q)
      )
    }
    if (showFavOnly) {
      list = list.filter(i => favorites.includes(i.id))
    }
    return list
  }, [items, query, showFavOnly, favorites])

  const groups = useMemo(() => {
    // 1. Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title)
      if (sortBy === 'abbr') return a.abbreviation.localeCompare(b.abbreviation)
      if (sortBy === 'date') return (b.dateAdded || '').localeCompare(a.dateAdded || '')
      return 0
    })

    // 2. Group
    if (groupBy === 'none') return { 'All': sorted }

    const g: Record<string, BenchItem[]> = {}
    for (const item of sorted) {
      let key = ''
      if (groupBy === 'abbr') {
        key = item.abbreviation
      } else if (groupBy === 'category') {
        key = getBenchmarkCategory(item.abbreviation)
      }
      if (!g[key]) g[key] = []
      g[key].push(item)
    }
    return g
  }, [filtered, sortBy, groupBy])

  const groupKeys = useMemo(() => Object.keys(groups).sort((a, b) => {
    if (a === 'All') return -1
    if (b === 'All') return 1
    if (a === DEFAULT_BENCHMARK_CATEGORY) return 1
    if (b === DEFAULT_BENCHMARK_CATEGORY) return -1
    return a.localeCompare(b)
  }), [groups])

  const getRandomId = () => {
    const list = filtered.length ? filtered : items
    if (list.length === 0) return null
    const r = list[Math.floor(Math.random() * list.length)]
    return r.id
  }

  return {
    query, setQuery,
    showFavOnly, setShowFavOnly,
    sortBy, setSortBy,
    groupBy, setGroupBy,
    groups, groupKeys,
    getRandomId,
    hasResults: filtered.length > 0,
    totalCount: items.length
  }
}

function BenchmarksExplore({ items, favorites, loading, onToggleFav, onOpen }: {
  items: BenchItem[];
  favorites: string[];
  loading: boolean;
  onToggleFav: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const {
    query, setQuery,
    showFavOnly, setShowFavOnly,
    sortBy, setSortBy,
    groupBy, setGroupBy,
    groups, groupKeys,
    getRandomId,
    hasResults
  } = useBenchmarkList(items, favorites)

  const handleRandom = () => {
    const id = getRandomId()
    if (id) onOpen(id)
  }

  return (
    <div className="space-y-4 h-full p-4 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-medium">Benchmark - Explore</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={16} className="text-secondary absolute left-2 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search benchmarks"
              className="pl-8 pr-2 py-2 rounded bg-surface-2 border border-primary text-sm placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent hover:bg-surface-3 w-32 sm:w-48 transition-all focus:w-64"
            />
          </div>

          <div className="flex items-center gap-1">
            <Dropdown
              prefix="Sort: "
              value={sortBy}
              onChange={(v) => setSortBy(v as any)}
              options={[
                { label: 'Name', value: 'name' },
                { label: 'Abbreviation', value: 'abbr' },
                { label: 'Date Added', value: 'date' },
              ]}
              size="md"
            />
          </div>

          <div className="flex items-center gap-1">
            <Dropdown
              prefix="Group: "
              value={groupBy}
              onChange={(v) => setGroupBy(v as any)}
              options={[
                { label: 'None', value: 'none' },
                { label: 'Abbreviation', value: 'abbr' },
                { label: 'Category', value: 'category' },
              ]}
              size="md"
            />
          </div>

          <button onClick={handleRandom} className="px-3 py-2 rounded bg-surface-2 border border-primary text-sm hover:bg-surface-3">Random</button>
          <button
            onClick={() => setShowFavOnly(!showFavOnly)}
            className={`px-3 py-2 rounded border text-sm flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${showFavOnly ? 'bg-accent/20 border-accent text-accent hover:bg-accent/30' : 'bg-surface-2 border-primary text-primary hover:bg-surface-3 hover:text-accent'}`}
            title={showFavOnly ? 'Showing favorites' : 'Show all'}
          >
            <Star
              size={16}
              strokeWidth={1.5}
              fill={showFavOnly ? 'currentColor' : 'none'}
            />
            {showFavOnly ? 'Favorites' : 'All'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {groupKeys.map(group => (
          <div key={group} className="space-y-2">
            {groupBy !== 'none' && (
              <div className="flex items-center gap-3 text-sm font-medium text-secondary mt-2 mb-2">
                <span className="whitespace-nowrap">{group} <span className="text-xs opacity-50">({groups[group].length})</span></span>
                <div className="h-px bg-primary/10 flex-1" />
              </div>
            )}
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
              {groups[group].map(b => (
                <BenchmarkCard
                  key={b.id}
                  id={b.id}
                  title={b.title}
                  abbreviation={b.abbreviation}
                  color={b.color}
                  isFavorite={favorites.includes(b.id)}
                  onOpen={onOpen}
                  onToggleFavorite={onToggleFav}
                />
              ))}
            </div>
          </div>
        ))}

        {!hasResults && (
          <div className="text-sm text-secondary">
            {loading ? 'Loading benchmarks…' : (
              showFavOnly ? (favorites.length ? 'No favorites match your filters.' : 'No favorites yet.') : (query ? 'No results.' : 'No benchmarks found.')
            )}
          </div>
        )}
      </div>
    </div>
  )
} type BenchmarksDetailProps = { id: string; bench?: Benchmark; favorites: string[]; onToggleFav: (id: string) => void; onBack: () => void }

function useBenchmarkShare() {
  const [renderShare, setRenderShare] = useState(false)
  const shareRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!renderShare) return
    let cancelled = false
    const doCapture = async () => {
      const node = shareRef.current
      if (!node) { setRenderShare(false); return }
      try {
        const imgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[]
        await Promise.all(imgs.map(img => new Promise<void>(resolve => {
          if (img.complete && img.naturalWidth !== 0) return resolve()
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        })))

        if (cancelled) return
        const bg = getComputedStyle(node).backgroundColor
        const res = await copyNodeToClipboard(node, { pixelRatio: 2, backgroundColor: bg })
        if (res.copied) {
          alert('Share image copied to clipboard!')
        } else {
          alert('Clipboard not available. Saved image instead.')
        }
      } catch (e) {
        alert('Failed to copy image: ' + (e as Error)?.message)
      } finally {
        setRenderShare(false)
      }
    }
    void doCapture()
    return () => { cancelled = true }
  }, [renderShare])

  return { renderShare, setRenderShare, shareRef }
}

function BenchmarksDetail({ id, bench, favorites, onToggleFav, onBack }: BenchmarksDetailProps) {
  const [tab, setTab] = useUIState<'overview' | 'analysis' | 'ai'>(`benchmark:${id}:tab`, 'overview')
  const { progress, loading, error, difficultyIndex, setDifficultyIndex } = useOpenedBenchmarkProgress({ id, bench: bench ?? null })
  const { renderShare, setRenderShare, shareRef } = useBenchmarkShare()

  return (
    <div className="space-y-3 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-surface-3 text-primary"
          aria-label="Back"
          title="Back"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-lg font-medium flex items-center gap-2">
          <span>Benchmark: {bench ? `${bench.abbreviation} ${bench.benchmarkName}` : id}</span>
          <button
            onClick={() => { if (bench) launchPlaylist(bench.difficulties[difficultyIndex].sharecode) }}
            disabled={!bench}
            className="p-1 rounded hover:bg-surface-3 text-primary mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Play benchmark playlist"
            title="Play benchmark playlist in Kovaak's"
          >
            <Play size={18} />
          </button>
          <button
            onClick={() => { if (bench && progress) setRenderShare(true) }}
            disabled={!bench || !progress}
            className="p-1 rounded hover:bg-surface-3 text-primary mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Copy share image"
            title="Copy share image to clipboard"
          >
            <Camera size={18} />
          </button>
          <button
            onClick={() => onToggleFav(id)}
            className={`p-1 rounded hover:bg-surface-3 mb-1 transition-colors ${favorites.includes(id) ? 'text-accent' : 'text-primary hover:text-accent'}`}
            aria-label={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
            title={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
          >
            <Star
              size={20}
              strokeWidth={1.5}
              fill={favorites.includes(id) ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
      {bench?.difficulties?.length ? (
        <div className="flex items-center gap-2">
          <Dropdown
            label="Difficulty"
            size="md"
            value={difficultyIndex}
            onChange={(v: string) => setDifficultyIndex(Number(v))}
            options={bench.difficulties.map((d, i) => ({ label: d.difficultyName, value: i }))}
          />
        </div>
      ) : <div className="text-sm text-secondary">No difficulties info.</div>}
      <Tabs tabs={[
        { id: 'overview', label: 'Overview', content: <OverviewTab bench={bench} difficultyIndex={difficultyIndex} loading={loading} error={error} progress={progress} /> },
        { id: 'analysis', label: 'Analysis', content: <AnalysisTab bench={bench} difficultyIndex={difficultyIndex} loading={loading} error={error} progress={progress} /> },
        { id: 'ai', label: 'AI Insights', content: <AiTab /> },
      ]} active={tab} onChange={(id) => setTab(id as any)} />

      {bench && progress && renderShare && (
        <div style={{ position: 'fixed', left: -99999, top: -99999, pointerEvents: 'none' }} aria-hidden>
          <div ref={shareRef}>
            <ShareBenchmarkProgress bench={bench} difficultyIndex={difficultyIndex} progress={progress!} />
          </div>
        </div>
      )}
    </div>
  )
}

export default BenchmarksPage

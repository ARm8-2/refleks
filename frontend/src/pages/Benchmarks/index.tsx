import { ChevronLeft, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BenchmarkCard, Dropdown, Tabs } from '../../components'
import { useOpenedBenchmarkProgress } from '../../hooks/useOpenedBenchmarkProgress'
import { navigate, useRoute } from '../../hooks/useRoute'
import { useUIState } from '../../hooks/useUIState'
import { getBenchmarks, getFavoriteBenchmarks, setFavoriteBenchmarks } from '../../lib/internal'
import type { Benchmark } from '../../types/ipc'
import { AiTab, AnalysisTab, OverviewTab } from './tabs'

type BenchItem = { id: string; title: string; abbreviation: string; subtitle?: string; color?: string }

export function BenchmarksPage() {
  const { query: routeQuery } = useRoute()
  const selected = routeQuery.b || null
  const [items, setItems] = useState<BenchItem[]>([])
  const [byId, setById] = useState<Record<string, Benchmark>>({})
  const [query, setQuery] = useState('')
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    getBenchmarks()
      .then((list: Benchmark[]) => {
        if (!isMounted) return
        const mapped: BenchItem[] = list.map(b => ({
          id: `${b.abbreviation}-${b.benchmarkName}`,
          title: b.benchmarkName,
          abbreviation: b.abbreviation,
          subtitle: b.rankCalculation,
          color: b.color,
        }))
        setItems(mapped)
        const map: Record<string, Benchmark> = {}
        for (const b of list) {
          map[`${b.abbreviation}-${b.benchmarkName}`] = b
        }
        setById(map)
      })
      .catch(err => {
        console.warn('getBenchmarks failed', err)
      })
    getFavoriteBenchmarks()
      .then(ids => { if (isMounted) setFavorites(ids) })
      .catch(() => { })
    return () => { isMounted = false }
  }, [])

  // selection is derived from URL; no local state or effects needed

  // selected comes from URL (?b)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items
    if (q) list = list.filter(i => i.title.toLowerCase().includes(q) || i.abbreviation.toLowerCase().includes(q) || (i.subtitle ?? '').toLowerCase().includes(q))
    if (showFavOnly) list = list.filter(i => favorites.includes(i.id))
    return list
  }, [items, query, showFavOnly, favorites])

  const toggleFavorite = async (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]
    setFavorites(next)
    try { await setFavoriteBenchmarks(next) } catch (e) { console.warn('setFavoriteBenchmarks failed', e) }
  }

  const pickRandom = () => {
    const list = filtered.length ? filtered : items
    if (list.length === 0) return
    const r = list[Math.floor(Math.random() * list.length)]
    navigate(`/benchmarks?b=${encodeURIComponent(r.id)}`)
  }

  return selected
    ? <BenchmarksDetail bench={byId[selected!]} id={selected} favorites={favorites} onToggleFav={toggleFavorite} onBack={() => navigate('/benchmarks')} />
    : <BenchmarksExplore
      items={filtered}
      favorites={favorites}
      onToggleFav={toggleFavorite}
      onOpen={(id) => navigate(`/benchmarks?b=${encodeURIComponent(id)}`)}
      query={query}
      onQuery={setQuery}
      showFavOnly={showFavOnly}
      onToggleFavOnly={() => setShowFavOnly(v => !v)}
      onRandom={pickRandom}
    />
}

function BenchmarksExplore({ items, favorites, onToggleFav, onOpen, query, onQuery, showFavOnly, onToggleFavOnly, onRandom }:
  { items: BenchItem[]; favorites: string[]; onToggleFav: (id: string) => void; onOpen: (id: string) => void; query: string; onQuery: (v: string) => void; showFavOnly: boolean; onToggleFavOnly: () => void; onRandom: () => void }) {
  return (
    <div className="space-y-4 h-full p-4 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-medium">Benchmark — Explore</div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="text-[var(--text-secondary)] absolute left-2 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
            <input
              value={query}
              onChange={e => onQuery(e.target.value)}
              placeholder="Search benchmarks..."
              aria-label="Search benchmarks"
              className="pl-8 pr-2 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]"
            />
          </div>
          <button onClick={onRandom} className="px-2 py-1.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm hover:bg-[var(--bg-secondary)]">Random</button>
          <button
            onClick={onToggleFavOnly}
            className={`px-2 py-1.5 rounded border text-sm flex items-center gap-2 ${showFavOnly ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--text-primary)]' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}`}
            title={showFavOnly ? 'Showing favorites' : 'Show all'}
          >
            <Star size={16} strokeWidth={1.5} style={{ color: showFavOnly ? 'var(--accent-primary)' as any : undefined, fill: showFavOnly ? 'var(--accent-primary)' : 'none' }} />
            {showFavOnly ? 'Favorites' : 'All'}
          </button>
        </div>
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
        {items.map(b => (
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
        {items.length === 0 && <div className="text-sm text-[var(--text-secondary)]">{query ? 'No results.' : 'Loading benchmarks…'}</div>}
      </div>
    </div>
  )
}

function BenchmarksDetail({ id, bench, favorites, onToggleFav, onBack }: { id: string; bench?: Benchmark; favorites: string[]; onToggleFav: (id: string) => void; onBack: () => void }) {
  const [tab, setTab] = useUIState<'overview' | 'analysis' | 'ai'>(`Benchmark:${id}:tab`, 'overview')
  // Use shared hook for progress + live updates and difficulty state
  const { progress, loading, error, difficultyIndex, setDifficultyIndex } = useOpenedBenchmarkProgress({ id, bench: bench ?? null })

  return (
    <div className="space-y-3 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
          aria-label="Back"
          title="Back"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-lg font-medium flex items-center gap-2">
          <span>Benchmark: {bench ? `${bench.abbreviation} ${bench.benchmarkName}` : id}</span>
          <button
            onClick={() => onToggleFav(id)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] mb-1"
            aria-label={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
            title={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
          >
            <Star
              size={20}
              strokeWidth={1.5}
              style={{ color: (favorites.includes(id) ? 'var(--accent-primary)' : undefined) as any, fill: favorites.includes(id) ? 'var(--accent-primary)' : 'none' }}
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
      ) : <div className="text-sm text-[var(--text-secondary)]">No difficulties info.</div>}
      <Tabs tabs={[
        { id: 'overview', label: 'Overview', content: <OverviewTab bench={bench} difficultyIndex={difficultyIndex} loading={loading} error={error} progress={progress} /> },
        { id: 'analysis', label: 'Analysis', content: <AnalysisTab bench={bench} difficultyIndex={difficultyIndex} loading={loading} error={error} progress={progress} /> },
        { id: 'ai', label: 'AI Insights', content: <AiTab /> },
      ]} active={tab} onChange={(id) => setTab(id as any)} />
    </div>
  )
}

export default BenchmarksPage

import { ArrowLeft, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EventsOn } from '../../../wailsjs/runtime'
import { BenchmarkCard, Tabs } from '../../components'
import { getBenchmarkProgress, getBenchmarks, getFavoriteBenchmarks, setFavoriteBenchmarks } from '../../lib/internal'
import { useUIState } from '../../store/ui'
import type { Benchmark } from '../../types/ipc'
import { AiTab, OverviewTab } from './tabs'

type BenchItem = { id: string; title: string; abbreviation: string; subtitle?: string; color?: string }

export function BenchmarksPage() {
  const [selected, setSelected] = useUIState<string | null>('Benchmark:selected', null)
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

  // selected persisted via hook
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
    setSelected(r.id)
  }

  return selected
    ? <BenchmarksDetail bench={byId[selected!]} id={selected} favorites={favorites} onToggleFav={toggleFavorite} onBack={() => setSelected(null)} />
    : <BenchmarksExplore
      items={filtered}
      favorites={favorites}
      onToggleFav={toggleFavorite}
      onOpen={setSelected}
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
  const [tab, setTab] = useUIState<'overview' | 'ai'>(`Benchmark:${id}:tab`, 'overview')
  const [difficultyIdx, setDifficultyIdx] = useUIState<number>(`Benchmark:${id}:difficultyIdx`, 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, any> | null>(null)

  // persisted via hook
  useEffect(() => {
    if (!bench || !bench.difficulties?.length) return
    const idx = Math.min(difficultyIdx, bench.difficulties.length - 1)
    const did = bench.difficulties[idx].kovaaksBenchmarkId
    let cancelled = false
    setLoading(true); setError(null)
    getBenchmarkProgress(did)
      .then((data) => { if (!cancelled) setProgress(data) })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bench, difficultyIdx])

  // Live refresh: when scenarios are added/updated, re-fetch the current difficulty's progress
  useEffect(() => {
    if (!bench || !bench.difficulties?.length) return
    const idx = Math.min(difficultyIdx, bench.difficulties.length - 1)
    const did = bench.difficulties[idx].kovaaksBenchmarkId
    let cancelled = false
    let t: any = null

    const refresh = () => {
      if (cancelled) return
      // Silent refresh: don't toggle global loading to avoid UI flicker
      getBenchmarkProgress(did)
        .then((data) => { if (!cancelled) setProgress(data) })
        .catch((e) => { if (!cancelled) setError(String(e?.message || e)) })
    }

    const trigger = () => {
      if (cancelled) return
      if (t) clearTimeout(t)
      // Debounce a bit in case multiple events fire during import
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
  }, [bench, difficultyIdx])

  return (
    <div className="space-y-3 p-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-[var(--text-primary)] hover:text-white inline-flex items-center gap-1">
          <ArrowLeft size={14} className="inline-block align-[-2px]" />
          Back
        </button>
        <button onClick={() => onToggleFav(id)} className="px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm flex items-center gap-2">
          <Star size={16} strokeWidth={1.5} style={{ color: favorites.includes(id) ? 'var(--accent-primary)' as any : undefined, fill: favorites.includes(id) ? 'var(--accent-primary)' : 'none' }} />
          {favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
        </button>
      </div>
      <div className="text-lg font-medium">Benchmark: {bench ? `${bench.abbreviation} ${bench.benchmarkName}` : id}</div>
      {bench?.difficulties?.length ? (
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Difficulty</label>
          <select
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded px-2 py-1 text-sm"
            value={difficultyIdx}
            onChange={(e) => setDifficultyIdx(Number(e.target.value))}
          >
            {bench.difficulties.map((d, i) => (
              <option key={d.kovaaksBenchmarkId} value={i}>{d.difficultyName}</option>
            ))}
          </select>
        </div>
      ) : <div className="text-sm text-[var(--text-secondary)]">No difficulties info.</div>}
      <Tabs tabs={[
        { id: 'overview', label: 'Overview', content: <OverviewTab bench={bench} difficultyIndex={difficultyIdx} loading={loading} error={error} progress={progress} /> },
        { id: 'ai', label: 'AI Insights', content: <AiTab /> },
      ]} active={tab} onChange={(id) => setTab(id as any)} />
    </div>
  )
}

export default BenchmarksPage

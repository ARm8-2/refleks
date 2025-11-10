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
import type { Benchmark } from '../../types/ipc'
import { AiTab, AnalysisTab, OverviewTab } from './tabs'

type BenchItem = { id: string; title: string; abbreviation: string; subtitle?: string; color?: string }

export function BenchmarksPage() {
  const [sp, setSp] = useSearchParams()
  const selected = sp.get('b') || null
  // Global open benchmark id (shared across pages)
  const [openBenchId, setOpenBenchId] = useUIState<string | null>('global:openBenchmark', null)
  const [items, setItems] = useState<BenchItem[]>([])
  const [byId, setById] = useState<Record<string, Benchmark>>({})
  const [benchLoading, setBenchLoading] = useState<boolean>(true)
  const [query, setQuery] = usePageState<string>('explore:query', '')
  const [showFavOnly, setShowFavOnly] = usePageState<boolean>('explore:showFavOnly', false)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    setBenchLoading(true)
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
        setBenchLoading(false)
      })
      .catch(err => {
        console.warn('getBenchmarks failed', err)
        setBenchLoading(false)
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
    setOpenBenchId(r.id)
    setSp({ b: r.id })
  }

  // Keep last selected benchmark in per-page state
  useEffect(() => {
    if (selected && selected !== openBenchId) setOpenBenchId(selected)
  }, [selected, openBenchId, setOpenBenchId])

  // On first mount, if no selection in URL but we have a remembered one, restore it
  useEffect(() => {
    if (!selected && openBenchId) {
      const params = new URLSearchParams(sp)
      params.set('b', openBenchId)
      setSp(params, { replace: true })
    }
  }, [selected, openBenchId, setSp, sp])

  return selected
    ? <BenchmarksDetail bench={byId[selected!]} id={selected} favorites={favorites} onToggleFav={toggleFavorite} onBack={() => { const p = new URLSearchParams(sp); p.delete('b'); setSp(p); setOpenBenchId(null) }} />
    : <BenchmarksExplore
      items={filtered}
      favorites={favorites}
      loading={benchLoading}
      onToggleFav={toggleFavorite}
      onOpen={(id) => { setOpenBenchId(id); setSp({ b: id }) }}
      query={query}
      onQuery={setQuery}
      showFavOnly={showFavOnly}
      onToggleFavOnly={() => setShowFavOnly(v => !v)}
      onRandom={pickRandom}
    />
}

function BenchmarksExplore({ items, favorites, loading, onToggleFav, onOpen, query, onQuery, showFavOnly, onToggleFavOnly, onRandom }:
  { items: BenchItem[]; favorites: string[]; loading: boolean; onToggleFav: (id: string) => void; onOpen: (id: string) => void; query: string; onQuery: (v: string) => void; showFavOnly: boolean; onToggleFavOnly: () => void; onRandom: () => void }) {
  return (
    <div className="space-y-4 h-full p-4 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-medium">Benchmark - Explore</div>
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
            className={`px-2 py-1.5 rounded border text-sm flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-[var(--border-primary)] ${showFavOnly ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--text-primary)] hover:bg-[var(--accent-primary)]/30' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] hover:bg-[var(--bg-secondary)]'}`}
            title={showFavOnly ? 'Showing favorites' : 'Show all'}
          >
            <Star size={16} strokeWidth={1.5} style={{ color: showFavOnly ? 'var(--accent-primary)' : undefined, fill: showFavOnly ? 'var(--accent-primary)' : 'none' }} />
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
        {items.length === 0 && (
          <div className="text-sm text-[var(--text-secondary)]">
            {loading ? 'Loading benchmarks…' : (
              showFavOnly ? (favorites.length ? 'No favorites match your filters.' : 'No favorites yet.') : (query ? 'No results.' : 'No benchmarks found.')
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type BenchmarksDetailProps = { id: string; bench?: Benchmark; favorites: string[]; onToggleFav: (id: string) => void; onBack: () => void }

function BenchmarksDetail({ id, bench, favorites, onToggleFav, onBack }: BenchmarksDetailProps) {
  const [tab, setTab] = useUIState<'overview' | 'analysis' | 'ai'>(`Benchmark:${id}:tab`, 'overview')
  // Use shared hook for progress + live updates and difficulty state
  const { progress, loading, error, difficultyIndex, setDifficultyIndex } = useOpenedBenchmarkProgress({ id, bench: bench ?? null })

  // Share image: render offscreen card on demand and copy to clipboard
  const [renderShare, setRenderShare] = useState(false)
  const shareRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!renderShare) return
    let cancelled = false
    const doCapture = async () => {
      const node = shareRef.current
      if (!node) { setRenderShare(false); return }
      try {
        // Wait for any images inside the share node to finish loading so html-to-image captures them
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
          {/* Play playlist for selected difficulty */}
          <button
            onClick={() => { if (bench) launchPlaylist(bench.difficulties[difficultyIndex].sharecode) }}
            disabled={!bench}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Play benchmark playlist"
            title="Play benchmark playlist in Kovaak's"
          >
            <Play size={18} />
          </button>
          {/* Share (screenshot) button */}
          <button
            onClick={() => { if (bench && progress) setRenderShare(true) }}
            disabled={!bench || !progress}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Copy share image"
            title="Copy share image to clipboard"
          >
            <Camera size={18} />
          </button>
          <button
            onClick={() => onToggleFav(id)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] mb-1"
            aria-label={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
            title={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
          >
            <Star
              size={20}
              strokeWidth={1.5}
              style={{ color: favorites.includes(id) ? 'var(--accent-primary)' : undefined, fill: favorites.includes(id) ? 'var(--accent-primary)' : 'none' }}
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

      {/* Offscreen share renderer */}
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

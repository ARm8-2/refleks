import { ChevronDown, Dice5, Search, Sparkles, Star } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown, type DropdownOption } from '../../../shared/components/Dropdown'
import { Loading } from '../../../shared/components/Loading'
import { useBenchmarks } from '../../../shared/hooks/useBenchmarks'
import { usePersistedState } from '../../../shared/hooks/usePersistedState'
import { useStore } from '../../../shared/hooks/useStore'
import type { Benchmark } from '../../../shared/types/ipc'
import { BenchmarkCard } from '../components/BenchmarkCard'
import { getRecommendedBenchmarks } from '../lib/recommendations'

// ---------------------------------------------------------------------------
// Category mapping — maps benchmark abbreviations to high-level categories
// ---------------------------------------------------------------------------

const BENCHMARK_CATEGORIES: Record<string, string[]> = {
  'Aim Groups': ['VT', 'rA', 'xyz', 'A+', 'cAt', 'CB', 'MIR', 'STR', 'JP', 'cA', 'STK', 'TSK', 'RXZU'],
  'Community Benchmarks': ['AQ!', 'AOI', 'e', 'roa', 'AS', 'ATB', 'ATF', 'cR', 'DM', 'ETB', 'GM', 'HEW', 'mHb', 'pA', 'PG', 'sA', 'R&G', 'RBE', 'rxn', 'Ssb', 'TNT', 'TZY', 'VR', 'pnv1', 'SFB'],
  'Notable Creator Benchmarks': ['A', 'w', 'TPT', 'm', 'M', 'WH', 'V', 'D&R', 'MH', 'LEM'],
}
const DEFAULT_CATEGORY = 'Other'

function getBenchmarkCategory(abbreviation: string): string {
  const abbr = (abbreviation ?? '').trim()
  if (!abbr) return DEFAULT_CATEGORY
  for (const [cat, aliases] of Object.entries(BENCHMARK_CATEGORIES)) {
    if (aliases.includes(abbr)) return cat
  }
  return DEFAULT_CATEGORY
}

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SortBy = 'name' | 'abbreviation' | 'date'
type GroupBy = 'none' | 'abbreviation' | 'category'

const sortOptions: DropdownOption[] = [
  { label: 'Name', value: 'name' },
  { label: 'Abbreviation', value: 'abbreviation' },
  { label: 'Date Added', value: 'date' },
]

const groupOptions: DropdownOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Abbreviation', value: 'abbreviation' },
  { label: 'Category', value: 'category' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarksExplorePage() {
  const navigate = useNavigate()
  const { benchmarks, loading, isFavorite, toggleFavorite, progressMap, loadAllProgress, selectedBenchmark } = useBenchmarks()
  const sessions = useStore(s => s.sessions)

  // Redirect to last-viewed benchmark if returning from another page
  useEffect(() => {
    if (selectedBenchmark) {
      navigate(`/benchmarks/${encodeURIComponent(selectedBenchmark)}`, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render explore content while redirecting
  if (selectedBenchmark) return null

  // Persisted page-level UI state
  const [query, setQuery] = usePersistedState('refleks.benchmarks.query', '')
  const [showFavOnly, setShowFavOnly] = usePersistedState('refleks.benchmarks.favOnly', false)
  const [showRecs, setShowRecs] = usePersistedState('refleks.benchmarks.showRecs', false)
  const [sortBy, setSortBy] = usePersistedState<SortBy>('refleks.benchmarks.sortBy', 'abbreviation')
  const [groupBy, setGroupBy] = usePersistedState<GroupBy>('refleks.benchmarks.groupBy', 'category')
  const [collapsedGroups, setCollapsedGroups] = usePersistedState<Record<string, boolean>>('refleks.benchmarks.collapsed', {})

  const toggleGroup = (group: string) =>
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }))

  // Load all progress data when recommendations are enabled
  useEffect(() => {
    if (showRecs) loadAllProgress()
  }, [showRecs, loadAllProgress])

  // Recommended benchmarks
  const recommendedBenchmarks = useMemo(() => {
    if (!showRecs || benchmarks.length === 0) return []
    return getRecommendedBenchmarks(benchmarks, progressMap, sessions)
  }, [showRecs, benchmarks, progressMap, sessions])

  // Filtered list
  const filtered = useMemo(() => {
    let items = benchmarks

    if (showFavOnly) {
      items = items.filter(b => isFavorite(b.benchmarkName))
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter(b =>
        b.benchmarkName.toLowerCase().includes(q) ||
        b.abbreviation.toLowerCase().includes(q),
      )
    }

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'abbreviation':
          return a.abbreviation.localeCompare(b.abbreviation)
        case 'date':
          return (b.dateAdded || '').localeCompare(a.dateAdded || '')
        default:
          return a.benchmarkName.localeCompare(b.benchmarkName)
      }
    })
  }, [benchmarks, query, showFavOnly, sortBy, isFavorite])

  // Grouped result
  const { groups, groupKeys } = useMemo(() => {
    if (groupBy === 'none') {
      return { groups: { All: filtered }, groupKeys: ['All'] }
    }

    const g: Record<string, Benchmark[]> = {}
    for (const item of filtered) {
      const key = groupBy === 'abbreviation'
        ? item.abbreviation
        : getBenchmarkCategory(item.abbreviation)
      if (!g[key]) g[key] = []
      g[key].push(item)
    }

    const keys = Object.keys(g).sort((a, b) => {
      if (a === 'All') return -1
      if (b === 'All') return 1
      // Push "Other" to the end
      if (a === DEFAULT_CATEGORY) return 1
      if (b === DEFAULT_CATEGORY) return -1
      return a.localeCompare(b)
    })

    return { groups: g, groupKeys: keys }
  }, [filtered, groupBy])

  const handleRandom = () => {
    const list = filtered.length ? filtered : benchmarks
    if (list.length === 0) return
    const b = list[Math.floor(Math.random() * list.length)]
    navigate(`/benchmarks/${encodeURIComponent(b.benchmarkName)}`)
  }

  const handleSelectBenchmark = (name: string) => {
    navigate(`/benchmarks/${encodeURIComponent(name)}`)
  }

  if (loading) return <Loading />

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-primary px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-primary">Benchmarks</h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-2 text-sm rounded bg-surface-2 border border-primary text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent w-32 sm:w-48 focus:w-64 transition-all"
              />
            </div>

            {/* Sort */}
            <Dropdown
              prefix="Sort: "
              value={sortBy}
              onChange={v => setSortBy(v as SortBy)}
              options={sortOptions}
              size="md"
            />

            {/* Group */}
            <Dropdown
              prefix="Group: "
              value={groupBy}
              onChange={v => setGroupBy(v as GroupBy)}
              options={groupOptions}
              size="md"
            />

            {/* Random */}
            <button
              onClick={handleRandom}
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-surface-2 border border-primary text-sm text-secondary hover:text-primary hover:bg-surface-3 transition-colors"
              title="Open a random benchmark"
            >
              <Dice5 className="w-4 h-4" />
              Random
            </button>

            {/* Favorites filter */}
            <button
              onClick={() => setShowFavOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded border transition-colors ${showFavOnly
                ? 'bg-accent/20 border-accent text-accent hover:bg-accent/30'
                : 'bg-surface-2 border-primary text-secondary hover:text-primary hover:bg-surface-3'
                }`}
              title={showFavOnly ? 'Show all benchmarks' : 'Show favorites only'}
            >
              <Star className="w-4 h-4" fill={showFavOnly ? 'currentColor' : 'none'} />
              {showFavOnly ? 'Favorites' : 'All'}
            </button>

            {/* Recommendations toggle */}
            <button
              onClick={() => setShowRecs(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded border transition-colors ${showRecs
                ? 'bg-accent/20 border-accent text-accent hover:bg-accent/30'
                : 'bg-surface-2 border-primary text-secondary hover:text-primary hover:bg-surface-3'
                }`}
              title={showRecs ? 'Hide recommendations' : 'Show recommended benchmarks'}
            >
              <Sparkles className="w-4 h-4" />
              Recommended
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Recommended benchmarks section */}
        {showRecs && recommendedBenchmarks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-accent mt-1 mb-2 select-none">
              <Sparkles size={16} />
              <span className="whitespace-nowrap">
                Recommended{' '}
                <span className="text-xs opacity-50">({recommendedBenchmarks.length})</span>
              </span>
              <div className="h-px bg-accent/20 flex-1" />
            </div>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
              {recommendedBenchmarks.map(b => (
                <BenchmarkCard
                  key={b.benchmarkName}
                  benchmark={b}
                  isFavorite={isFavorite(b.benchmarkName)}
                  onToggleFavorite={() => toggleFavorite(b.benchmarkName)}
                  onSelect={() => handleSelectBenchmark(b.benchmarkName)}
                />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-sm text-secondary py-8 text-center">
            {benchmarks.length === 0
              ? 'No benchmarks available.'
              : showFavOnly
                ? 'No favorite benchmarks yet. Star a benchmark to add it here.'
                : query
                  ? 'No benchmarks match your search.'
                  : 'No benchmarks found.'}
          </div>
        ) : (
          groupKeys.map(group => {
            const isCollapsed = collapsedGroups[group] || false
            const items = groups[group]

            return (
              <div key={group} className="space-y-2">
                {/* Group header (only when grouping is active) */}
                {groupBy !== 'none' && (
                  <button
                    onClick={() => toggleGroup(group)}
                    className="flex items-center gap-2 text-sm font-medium text-secondary mt-2 mb-2 w-full hover:text-primary transition-colors text-left group/hdr select-none"
                  >
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                    <span className="whitespace-nowrap">
                      {group}{' '}
                      <span className="text-xs opacity-50">({items.length})</span>
                    </span>
                    <div className="h-px bg-primary/10 flex-1 group-hover/hdr:bg-primary/20 transition-colors" />
                  </button>
                )}

                {/* Cards grid */}
                {!isCollapsed && (
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                    {items.map(b => (
                      <BenchmarkCard
                        key={b.benchmarkName}
                        benchmark={b}
                        isFavorite={isFavorite(b.benchmarkName)}
                        onToggleFavorite={() => toggleFavorite(b.benchmarkName)}
                        onSelect={() => handleSelectBenchmark(b.benchmarkName)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

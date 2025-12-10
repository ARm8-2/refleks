import { ChevronDown, Search, Star } from 'lucide-react'
import { useMemo } from 'react'
import { BenchmarkCard, Dropdown } from '../../components'
import { usePageState } from '../../hooks/usePageState'
import { useUIState } from '../../hooks/useUIState'
import { DEFAULT_BENCHMARK_CATEGORY, getBenchmarkCategory } from '../../lib/utils'
import type { BenchmarkListItem } from '../../types/domain'

function useBenchmarkList(items: BenchmarkListItem[], favorites: string[]) {
  const [query, setQuery] = usePageState<string>('explore:query', '')
  const [showFavOnly, setShowFavOnly] = usePageState<boolean>('explore:showFavOnly', false)
  const [sortBy, setSortBy] = usePageState<'name' | 'abbr' | 'date'>('explore:sortBy', 'name')
  const [groupBy, setGroupBy] = usePageState<'none' | 'abbr' | 'category'>('explore:groupBy', 'none')

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

    const g: Record<string, BenchmarkListItem[]> = {}
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

export function BenchmarksExplore({ items, favorites, loading, onToggleFav, onOpen }: {
  items: BenchmarkListItem[];
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

  const [collapsedGroups, setCollapsedGroups] = useUIState<Record<string, boolean>>('explore:collapsedGroups', {})
  const toggleGroup = (group: string) => setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }))

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
        {groupKeys.map(group => {
          const isCollapsed = collapsedGroups[group] || false
          return (
            <div key={group} className="space-y-2">
              {groupBy !== 'none' && (
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex items-center gap-2 text-sm font-medium text-secondary mt-2 mb-2 w-full hover:text-primary transition-colors text-left group select-none"
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                  <span className="whitespace-nowrap">{group} <span className="text-xs opacity-50">({groups[group].length})</span></span>
                  <div className="h-px bg-primary/10 flex-1 group-hover:bg-primary/20 transition-colors" />
                </button>
              )}
              {!isCollapsed && (
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
              )}
            </div>
          )
        })}

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
}

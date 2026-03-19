import { ArrowUpDown, CalendarRange, Check, ListFilter, PanelLeftClose, PanelLeftOpen, Search, Trophy } from 'lucide-react'
import { useCallback } from 'react'
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '../../../shared/components'
import { cn } from '../../../shared/lib'
import type { Session } from '../../../shared/types/domain'
import type { SessionSortKey } from '../hooks/useHistoryPageState'
import {
  formatCompactDate,
  formatDurationLabel,
  formatRelativeTime,
  formatSessionTitle,
  readSessionDurationMs,
  readSessionEndTimestamp,
} from '../lib/historyModels'
import { VirtualList } from './VirtualList'

type Props = {
  sessions: Session[]
  selectedSessionId: string | null
  collapsed: boolean
  query: string
  onQueryChange: (value: string) => void
  onSelectSession: (sessionId: string) => void
  onToggleCollapsed: () => void
  sort: SessionSortKey
  onSortChange: (sort: SessionSortKey) => void
  filterPb: boolean
  onFilterPbChange: (v: boolean | ((prev: boolean) => boolean)) => void
}

export function HistorySessionSidebar({
  sessions,
  selectedSessionId,
  collapsed,
  query,
  onQueryChange,
  onSelectSession,
  onToggleCollapsed,
  sort,
  onSortChange,
  filterPb,
  onFilterPbChange,
}: Props) {
  const hasActiveFilters = sort !== 'newest' || filterPb
  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-card shrink-0 transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        {!collapsed && (
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              placeholder="Search..."
              className="h-9 pl-8"
            />
          </div>
        )}
        {!collapsed && (
          <SessionSortFilter
            sort={sort}
            onSortChange={onSortChange}
            filterPb={filterPb}
            onFilterPbChange={onFilterPbChange}
            hasActiveFilters={hasActiveFilters}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sessions' : 'Collapse sessions'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* List */}
      <VirtualList
        items={sessions}
        estimateSize={collapsed ? 52 : 56}
        className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-2"
        emptyContent={
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {collapsed ? '—' : 'No sessions found.'}
          </p>
        }
        renderItem={useCallback(
          (session: Session) => {
            const selected = session.id === selectedSessionId
            const ts = readSessionEndTimestamp(session)

            if (collapsed) {
              return (
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    'flex w-full flex-col items-center rounded-xl px-1 py-2 text-center transition-colors',
                    selected ? 'bg-muted font-medium' : 'hover:bg-muted',
                  )}
                  title={formatSessionTitle(session)}
                >
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{formatCompactDate(ts)}</span>
                </button>
              )
            }

            return (
              <button
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-left transition-colors',
                  selected ? 'bg-muted font-medium' : 'hover:bg-muted',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate text-foreground">{formatSessionTitle(session)}</div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(ts)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{session.items.length} {session.items.length === 1 ? 'run' : 'runs'}</span>
                  <span>·</span>
                  <span>{formatDurationLabel(readSessionDurationMs(session))}</span>
                </div>
              </button>
            )
          },
          [collapsed, selectedSessionId, onSelectSession],
        )}
      />
    </aside>
  )
}

/* ─── Sort dropdown ─── */

const SESSION_SORT_OPTIONS: { value: SessionSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most-runs', label: 'Most runs' },
  { value: 'longest', label: 'Longest' },
]

function SessionSortFilter({
  sort,
  onSortChange,
  filterPb,
  onFilterPbChange,
  hasActiveFilters,
}: {
  sort: SessionSortKey
  onSortChange: (v: SessionSortKey) => void
  filterPb: boolean
  onFilterPbChange: (v: boolean | ((prev: boolean) => boolean)) => void
  hasActiveFilters: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? 'secondary' : 'ghost'}
          size="icon"
          className="shrink-0"
          title="Sort & filter"
        >
          <ListFilter className={cn('h-4 w-4', hasActiveFilters && 'text-foreground')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44">
        {/* Sort */}
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <ArrowUpDown className="mr-1 inline h-3 w-3" />Sort
        </div>
        {SESSION_SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSortChange(opt.value)}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-colors',
              sort === opt.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Check className={cn('h-3 w-3 shrink-0', sort === opt.value ? 'opacity-100' : 'opacity-0')} />
            {opt.label}
          </button>
        ))}

        {/* Divider */}
        <div className="my-1 border-t border-border" />

        {/* Filters */}
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <ListFilter className="mr-1 inline h-3 w-3" />Filter
        </div>
        <button
          type="button"
          onClick={() => onFilterPbChange(v => !v)}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-colors',
            filterPb ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Trophy className={cn('h-3 w-3 shrink-0', filterPb ? 'text-amber-500' : 'opacity-40')} />
          Contains PB
        </button>
      </PopoverContent>
    </Popover>
  )
}

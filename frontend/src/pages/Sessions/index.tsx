import { ListFilter, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Dropdown, Input, ListDetail, Tabs } from '../../components'
import { usePageState } from '../../hooks/usePageState'
import { useStore } from '../../hooks/useStore'
import { useUIState } from '../../hooks/useUIState'
import { formatDuration, formatRelativeAgoShort, getHighScores } from '../../lib/utils'
import type { Session } from '../../types/domain'
import { AiTab, OverviewTab, ProgressAllTab } from './tabs'

export function SessionsPage() {
  const sessions = useStore(s => s.sessions)
  const allScenarios = useStore(s => s.scenarios)
  const [active, setActive] = usePageState<string | null>('activeSession', sessions[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Auto-select most recent session when sessions list updates
  useEffect(() => {
    const newest = sessions[0]?.id ?? null
    setActive(newest ?? null)
  }, [sessions])

  const highScores = useMemo(() => getHighScores(allScenarios), [allScenarios])

  const filteredSessions = useMemo(() => {
    let out = sessions
    if (filter === 'highscore') {
      out = out.filter(s => s.items.some(item => {
        const name = String(item.stats['Scenario'] ?? '')
        const score = Number(item.stats['Score'] ?? 0)
        const max = highScores.get(name)
        return max !== undefined && score >= max
      }))
    } else if (filter !== 'all') {
      const min = parseInt(filter, 10)
      if (!isNaN(min) && min > 0) {
        out = out.filter(s => s.items.length >= min)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(s => s.items.some(i => String(i.stats['Scenario'] ?? '').toLowerCase().includes(q)))
    }
    return out
  }, [sessions, search, filter, highScores])

  const hasFilters = search.trim().length > 0 || filter !== 'all'

  return (
    <div className="space-y-4 h-full flex flex-col p-4">
      <div className="flex-1 min-h-0">
        <ListDetail
          id="sessions:recent"
          title="Recent Sessions"
          actions={
            <button
              className={`p-1 rounded hover:bg-surface-3 ${hasFilters ? 'text-accent' : showFilters ? 'text-primary' : 'text-secondary'}`}
              title="Filter"
              onClick={() => setShowFilters(!showFilters)}
            >
              <ListFilter size={14} />
            </button>
          }
          listHeader={showFilters ? (
            <div className="p-2 space-y-2">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search scenarios..."
                icon={<Search size={14} />}
                autoFocus
                fullWidth
                size="sm"
              />
              <div>
                <div className="text-xs text-secondary mb-1">Filter By</div>
                <Dropdown
                  value={filter}
                  onChange={setFilter}
                  fullWidth
                  options={[
                    { label: 'All Sessions', value: 'all' },
                    { label: 'Includes High Score', value: 'highscore' },
                    { label: '5+ Runs', value: '5' },
                    { label: '10+ Runs', value: '10' },
                    { label: '20+ Runs', value: '20' },
                  ]}
                />
              </div>
            </div>
          ) : null}
          items={filteredSessions}
          getKey={(s) => s.id}
          renderItem={(sess) => (
            <button key={sess.id} onClick={() => setActive(sess.id)} className={`w-full text-left p-2 rounded border ${active === sess.id ? 'bg-surface-3 border-primary' : 'border-primary hover:bg-surface-3'}`}>
              <div className="w-full">
                <div className="flex justify-between items-center">
                  <div className="font-medium text-primary">
                    {(() => {
                      const ts = Number.isFinite(Number(sess.start)) ? Number(sess.start) : Date.parse(String(sess.start))
                      if (!Number.isFinite(ts)) {
                        const raw = String(sess.start ?? '')
                        return <span title={raw}>{raw}</span>
                      }
                      const d = new Date(ts)
                      const dateOnly = d.toLocaleDateString()
                      return <span title={d.toLocaleString()}>{dateOnly}</span>
                    })()}
                  </div>
                  <div className="text-xs text-secondary ml-2 whitespace-nowrap text-right">
                    {(() => {
                      const ts = Number.isFinite(Number(sess.start)) ? Number(sess.start) : Date.parse(String(sess.start))
                      if (!Number.isFinite(ts)) return ''
                      const d = new Date(ts)
                      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      return timeStr
                    })()}
                  </div>
                </div>
                <div className="text-xs text-secondary flex justify-between items-center">
                  <div>
                    {(() => {
                      const tsn = (v: any) => {
                        const n = Date.parse(String(v ?? ''))
                        return Number.isFinite(n) ? n : 0
                      }
                      const a = tsn(sess.start)
                      const b = tsn(sess.end)
                      const duration = formatDuration(Math.abs(b - a))
                      return <span>{`${sess.items.length} runs${duration ? `, ${duration}` : ''}`}</span>
                    })()}
                  </div>
                  <div className="whitespace-nowrap text-right">
                    {(() => {
                      const ts = Number.isFinite(Number(sess.start)) ? Number(sess.start) : Date.parse(String(sess.start))
                      if (!Number.isFinite(ts)) return ''
                      return formatRelativeAgoShort(ts)
                    })()}
                  </div>
                </div>
              </div>
            </button>
          )}
          emptyPlaceholder={<div className="p-3 text-sm text-secondary">No sessions match your filters.</div>}
          detail={<SessionDetail session={sessions.find(s => s.id === active) ?? null} />}
        />
      </div>
    </div>
  )
}

function SessionDetail({ session }: { session: Session | null }) {
  const [tab, setTab] = useUIState<'overview' | 'progress' | 'ai'>('tabs:session', 'overview')
  const tabs = [
    { id: 'overview', label: 'Overview', content: <OverviewTab session={session} /> },
    { id: 'progress', label: 'Progress (all)', content: <ProgressAllTab /> },
    // Key AiTab by session id so it remounts on session change, while history persists via localStorage
    { id: 'ai', label: 'AI Insights', content: <AiTab key={session?.id ?? 'none'} sessionId={session?.id} records={session?.items} /> },
  ]
  return <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as any)} />
}

export default SessionsPage

import { useEffect } from 'react'
import { ListDetail, Tabs } from '../../components'
import { usePageState } from '../../hooks/usePageState'
import { useStore } from '../../hooks/useStore'
import { useUIState } from '../../hooks/useUIState'
import { formatRelativeDate } from '../../lib/utils'
import type { Session } from '../../types/domain'
import { AiTab, OverviewTab, ProgressAllTab } from './tabs'

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!h && (s || parts.length === 0)) parts.push(`${s}s`)
  return parts.join(' ')
}

export function SessionsPage() {
  const sessions = useStore(s => s.sessions)
  const [active, setActive] = usePageState<string | null>('activeSession', sessions[0]?.id ?? null)

  // Auto-select most recent session when sessions list updates
  useEffect(() => {
    const newest = sessions[0]?.id ?? null
    // If current active is missing or null, fall back to newest; otherwise preserve user's selection
    const exists = active ? sessions.some(s => s.id === active) : false
    if (!exists) {
      setActive(newest ?? null)
    }
  }, [sessions])

  return (
    <div className="space-y-4 h-full flex flex-col p-4">
      {/* <div className="text-lg font-medium">Session</div> */}
      <div className="flex-1 min-h-0">
        <ListDetail
          title="Recent Sessions"
          items={sessions}
          getKey={(s) => s.id}
          renderItem={(sess) => (
            <button key={sess.id} onClick={() => setActive(sess.id)} className={`w-full text-left p-2 rounded border ${active === sess.id ? 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]' : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
              <div className="font-medium text-[var(--text-primary)] flex items-center gap-1">
                {(() => {
                  const ts = Number.isFinite(Number(sess.start)) ? Number(sess.start) : Date.parse(String(sess.start))
                  if (!Number.isFinite(ts)) {
                    const raw = String(sess.start ?? '')
                    return <span title={raw}>{formatRelativeDate(raw)}</span>
                  }
                  const DAY = 24 * 3600 * 1000
                  const diff = Date.now() - ts
                  const d = new Date(ts)
                  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  if (diff < 0 || diff < DAY) {
                    return <span title={d.toLocaleString()}>{formatRelativeDate(ts)}{` • ${timeStr}`}</span>
                  }
                  const days = Math.floor(diff / DAY)
                  if (days < 7) {
                    return <span title={d.toLocaleString()}>{formatRelativeDate(ts)}{` • ${timeStr}`}</span>
                  }
                  // Older than a week: show full date but keep the same separator (•) between
                  // date and time for visual consistency.
                  const fullTitle = d.toLocaleString()
                  const dateOnly = d.toLocaleDateString()
                  const display = `${dateOnly} • ${timeStr}`
                  return <span title={fullTitle}>{display}</span>
                })()}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                {sess.items.length} scenarios
                {(() => {
                  const ts = (v: any) => {
                    const n = Date.parse(String(v ?? ''))
                    return Number.isFinite(n) ? n : 0
                  }
                  const a = ts(sess.start)
                  const b = ts(sess.end)
                  const duration = formatDuration(Math.abs(b - a))
                  return ` • duration: ${duration}`
                })()}
              </div>
            </button>
          )}
          emptyPlaceholder={<div className="p-3 text-sm text-[var(--text-secondary)]">No sessions yet.</div>}
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
    { id: 'ai', label: 'AI Insights', content: <AiTab /> },
  ]
  return <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as any)} />
}

export default SessionsPage

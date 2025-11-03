import { useEffect } from 'react'
import { ListDetail, Tabs } from '../../components'
import { usePageState } from '../../hooks/usePageState'
import { useStore } from '../../hooks/useStore'
import { useUIState } from '../../hooks/useUIState'
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

function formatRelativeAgoShort(input: string | number | Date | undefined, maxMonths = 12): string {
  if (input == null) return ''
  let ts: number
  if (typeof input === 'number') ts = input
  else if (input instanceof Date) ts = input.getTime()
  else {
    ts = Number.isFinite(Number(input)) ? Number(input) : Date.parse(String(input))
  }
  if (!Number.isFinite(ts)) return String(input)

  const now = Date.now()
  const diff = now - ts
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'now'
  const minutes = Math.floor(sec / 60)
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? '1 d ago' : `${days} d ago`
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7))
    return weeks === 1 ? '1 wk ago' : `${weeks} wk ago`
  }
  const months = Math.max(1, Math.floor(days / 30))
  const m = Math.min(months, Math.max(1, Math.floor(maxMonths)))
  return m === 1 ? '1 mo ago' : `${m} mo ago`
}

export function SessionsPage() {
  const sessions = useStore(s => s.sessions)
  const [active, setActive] = usePageState<string | null>('activeSession', sessions[0]?.id ?? null)

  // Auto-select most recent session when sessions list updates
  useEffect(() => {
    const newest = sessions[0]?.id ?? null
    setActive(newest ?? null)
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
              <div className="w-full">
                <div className="flex justify-between items-center">
                  <div className="font-medium text-[var(--text-primary)]">
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
                  <div className="text-xs text-[var(--text-secondary)] ml-2 whitespace-nowrap text-right">
                    {(() => {
                      const ts = Number.isFinite(Number(sess.start)) ? Number(sess.start) : Date.parse(String(sess.start))
                      if (!Number.isFinite(ts)) return ''
                      const d = new Date(ts)
                      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      return timeStr
                    })()}
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] flex justify-between items-center">
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

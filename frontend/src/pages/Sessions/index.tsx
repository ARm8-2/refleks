import { useEffect, useState } from 'react'
import { ListDetail, Tabs } from '../../components'
import { useStore } from '../../store/store'
import { useUIState } from '../../store/ui'
import type { Session } from '../../types/domain'
import { AiTab, OverviewTab } from './tabs'

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
  const [active, setActive] = useState<string | null>(sessions[0]?.id ?? null)

  // Auto-select most recent session when sessions list updates
  useEffect(() => {
    const newest = sessions[0]?.id ?? null
    if (newest && newest !== active) {
      setActive(newest)
    } else if (!newest && active !== null) {
      setActive(null)
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
                <span>{new Date(sess.start).toLocaleString()}</span>
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
          emptyPlaceholder={<div className="text-sm text-[var(--text-secondary)]">No sessions yet.</div>}
          detail={<SessionDetail session={sessions.find(s => s.id === active) ?? null} />}
        />
      </div>
    </div>
  )
}

function SessionDetail({ session }: { session: Session | null }) {
  const [tab, setTab] = useUIState<'overview' | 'ai'>('tabs:session', 'overview')
  const tabs = [
    { id: 'overview', label: 'Overview', content: <OverviewTab session={session} /> },
    { id: 'ai', label: 'AI Insights', content: <AiTab /> },
  ]
  return <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as any)} />
}

export default SessionsPage

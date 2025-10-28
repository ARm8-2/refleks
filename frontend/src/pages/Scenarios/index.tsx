import { Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EventsOn } from '../../../wailsjs/runtime'
import { ListDetail, Tabs } from '../../components'
import { setQuery, useRoute } from '../../hooks/useRoute'
import { useStore } from '../../hooks/useStore'
import { useUIState } from '../../hooks/useUIState'
import { getSettings, launchScenario } from '../../lib/internal'
import { getDatePlayed, getScenarioName } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'
import { AiTab, AnalysisTab, MouseTraceTab, RawTab } from './tabs'

export function ScenariosPage() {
  const scenarios = useStore(s => s.scenarios)
  const newCount = useStore(s => s.newScenarios)
  const { query: routeQuery } = useRoute()
  const [activeId, setActiveId] = useState<string | null>(scenarios[0]?.filePath ?? null)
  const active = useMemo(() => scenarios.find(s => s.filePath === activeId) ?? scenarios[0] ?? null, [scenarios, activeId])
  const [watchPath, setWatchPath] = useState<string>('stats')

  // Sync selection with URL: /scenario?file=...
  useEffect(() => {
    const qFile = routeQuery.file
    if (qFile && scenarios.some(s => s.filePath === qFile)) {
      if (activeId !== qFile) setActiveId(qFile)
    } else {
      // Fallback: ensure active points to an existing item, otherwise default to newest
      const exists = activeId ? scenarios.some(s => s.filePath === activeId) : false
      if (!exists) {
        setActiveId(scenarios[0]?.filePath ?? null)
      }
    }
  }, [routeQuery.file, scenarios, activeId])

  // Resolve current watch path for placeholder text; update on watcher restarts
  useEffect(() => {
    let off: (() => void) | null = null
    getSettings().then(s => {
      if (s && typeof s.statsDir === 'string' && s.statsDir.trim().length > 0) {
        setWatchPath(s.statsDir)
      }
    }).catch(() => { /* ignore */ })
    try {
      off = EventsOn('WatcherStarted', (data: any) => {
        const p = data && (data.path || data.Path)
        if (typeof p === 'string' && p.length > 0) {
          setWatchPath(p)
        }
      })
    } catch { /* ignore */ }
    return () => {
      try { off && off() } catch { /* ignore */ }
    }
  }, [])

  const prettyPath = useMemo(() => {
    const p = (watchPath || '').trim()
    if (!p) return 'stats/'
    // Add a trailing slash for readability
    return p.endsWith('/') ? p : p + '/'
  }, [watchPath])

  return (
    <div className="space-y-4 h-full flex flex-col p-4">
      {/* <div className="text-lg font-medium">Scenario</div> */}
      <div className="flex-1 min-h-0">
        <ListDetail
          title={`Recent Scenarios (${newCount})`}
          items={scenarios}
          getKey={(it) => it.filePath}
          renderItem={(it) => (
            <button key={it.filePath} onClick={() => { setActiveId(it.filePath); setQuery({ file: it.filePath }) }}
              className={`w-full text-left p-2 rounded border ${active?.filePath === it.filePath ? 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]' : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
              <div className="font-medium text-[var(--text-primary)]">{getScenarioName(it)}</div>
              <div className="text-xs text-[var(--text-secondary)]">{getDatePlayed(it.stats)}</div>
              <div className="text-xs text-[var(--text-secondary)]">Score: {it.stats['Score'] ?? '?'} • Acc: {formatPct(it.stats['Accuracy'])}</div>
            </button>
          )}
          emptyPlaceholder={<div className="p-3 text-sm text-[var(--text-secondary)]">Play a scenario in KovaaK's to see its stats here. Make sure your stats are being saved to the <code className="font-mono">{prettyPath}</code> folder.</div>}
          detailHeader={active ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-base font-medium text-[var(--text-primary)] truncate" title={String(active.stats['Scenario'] ?? getScenarioName(active))}>
                {active.stats['Scenario'] ?? getScenarioName(active)}
              </div>
              <button
                className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                title="Play in Kovaak's"
                onClick={() => {
                  const name = String(active.stats['Scenario'] ?? getScenarioName(active))
                  launchScenario(name, 'challenge').catch(() => { /* ignore */ })
                }}
              >
                <Play size={14} />
                <span>Play</span>
              </button>
            </div>
          ) : null}
          detail={<ScenarioDetail item={active ?? null} />}
        />
      </div>
    </div>
  )
}

function ScenarioDetail({ item }: { item: ScenarioRecord | null }) {
  const [tab, setTab] = useUIState<'raw' | 'analysis' | 'mouse' | 'ai'>('tabs:scenario', 'raw')
  const { query: routeQuery } = useRoute()
  useEffect(() => {
    // Keep tab in sync with URL if present
    const t = routeQuery.tab
    if (t && (t === 'raw' || t === 'analysis' || t === 'mouse' || t === 'ai')) {
      setTab(t as any)
    }
  }, [routeQuery.tab])
  if (!item) return <div className="text-sm text-[var(--text-secondary)]">No scenario selected.</div>
  const tabs = [
    { id: 'raw', label: 'Raw Stats', content: <RawTab item={item} /> },
    { id: 'analysis', label: 'Analysis', content: <AnalysisTab item={item} /> },
    { id: 'mouse', label: 'Mouse Trace', content: <MouseTraceTab item={item} /> },
    { id: 'ai', label: 'AI Insights', content: <AiTab /> },
  ]
  return <Tabs tabs={tabs} active={tab} onChange={(id) => { setTab(id as any); setQuery({ tab: String(id) }) }} />
}

function formatPct(v: any) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return '?'
  return (n * 100).toFixed(1) + '%'
}

export default ScenariosPage

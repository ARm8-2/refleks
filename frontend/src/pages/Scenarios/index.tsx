import { ListFilter, Play, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EventsOn } from '../../../wailsjs/runtime';
import { Dropdown } from '../../components/shared/Dropdown';
import { Input } from '../../components/shared/Input';
import { ListDetail } from '../../components/shared/ListDetail';
import { Tabs } from '../../components/shared/Tabs';
import { usePageState } from '../../hooks/usePageState';
import { useStore } from '../../hooks/useStore';
import { useUIState } from '../../hooks/useUIState';
import { getSettings, launchScenario } from '../../lib/internal';
import { formatPct01, getBestRuns, getDatePlayed, getScenarioName } from '../../lib/utils';
import type { ScenarioRecord } from '../../types/ipc';
import { AiTab } from './tabs/Ai';
import { AnalysisTab } from './tabs/Analysis';
import { MouseTraceTab } from './tabs/MouseTrace';
import { RawTab } from './tabs/Raw';

export function ScenariosPage() {
  const scenarios = useStore(s => s.scenarios)
  const [sp, setSp] = useSearchParams()
  const [activeId, setActiveId] = usePageState<string | null>('activeFile', scenarios[0]?.filePath ?? null)
  const active = useMemo(() => scenarios.find(s => s.filePath === activeId) ?? scenarios[0] ?? null, [scenarios, activeId])
  const [watchPath, setWatchPath] = useState<string>('stats')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('date')
  const [showFilters, setShowFilters] = useState(false)

  // Sync selection with URL: /scenario?file=...
  useEffect(() => {
    const qFile = sp.get('file')
    if (qFile && scenarios.some(s => s.filePath === qFile)) {
      if (activeId !== qFile) setActiveId(qFile)
    } else {
      // Fallback: ensure active points to an existing item, otherwise default to newest
      const exists = activeId ? scenarios.some(s => s.filePath === activeId) : false
      if (!exists) {
        setActiveId(scenarios[0]?.filePath ?? null)
      }
    }
  }, [sp, scenarios, activeId])

  // Resolve current watch path for placeholder text; update on watcher restarts
  useEffect(() => {
    let off: (() => void) | null = null
    getSettings().then(s => {
      if (s && typeof s.statsDir === 'string' && s.statsDir.trim().length > 0) {
        setWatchPath(s.statsDir)
      }
    }).catch(() => { /* ignore */ })
    try {
      off = EventsOn('watcher:started', (data: any) => {
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

  const filteredScenarios = useMemo(() => {
    let out = [...scenarios]
    if (filter === 'highscore') {
      out = getBestRuns(out)
    } else if (filter === 'acc90') {
      out = out.filter(s => (Number(s.stats['Accuracy'] ?? 0) >= 0.9))
    } else if (filter === 'acc80') {
      out = out.filter(s => (Number(s.stats['Accuracy'] ?? 0) >= 0.8))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(s => getScenarioName(s).toLowerCase().includes(q))
    }
    if (sort === 'score') {
      out.sort((a, b) => (Number(b.stats['Score'] ?? 0) - Number(a.stats['Score'] ?? 0)))
    } else if (sort === 'acc') {
      out.sort((a, b) => (Number(b.stats['Accuracy'] ?? 0) - Number(a.stats['Accuracy'] ?? 0)))
    }
    return out
  }, [scenarios, search, filter, sort])

  const prettyPath = useMemo(() => {
    const p = (watchPath || '').trim()
    if (!p) return 'stats/'
    // Add a trailing slash for readability
    return p.endsWith('/') ? p : p + '/'
  }, [watchPath])

  const hasFilters = search.trim().length > 0 || filter !== 'all' || sort !== 'date'

  return (
    <div className="space-y-4 h-full flex flex-col p-4">
      <div className="flex-1 min-h-0">
        <ListDetail
          id="scenarios:recent"
          title={`Recent Scenarios (${filteredScenarios.length})`}
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
                    { label: 'All', value: 'all' },
                    { label: 'High Scores Only', value: 'highscore' },
                    { label: 'Acc > 90%', value: 'acc90' },
                    { label: 'Acc > 80%', value: 'acc80' },
                  ]}
                />
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Sort By</div>
                <Dropdown
                  value={sort}
                  onChange={setSort}
                  fullWidth
                  options={[
                    { label: 'Date', value: 'date' },
                    { label: 'Score', value: 'score' },
                    { label: 'Accuracy', value: 'acc' },
                  ]}
                />
              </div>
            </div>
          ) : null}
          items={filteredScenarios}
          getKey={(it) => it.filePath}
          renderItem={(it) => (
            <button key={it.filePath} onClick={() => { setActiveId(it.filePath); const p = new URLSearchParams(sp); p.set('file', it.filePath); setSp(p) }}
              className={`w-full text-left p-2 rounded border ${active?.filePath === it.filePath ? 'bg-surface-3 border-primary' : 'border-primary hover:bg-surface-3'}`}>
              <div className="font-medium text-primary">{getScenarioName(it)}</div>
              <div className="text-xs text-secondary">{getDatePlayed(it.stats)}</div>
              <div className="text-xs text-secondary">Score: {it.stats['Score'] ?? '?'} • Acc: {formatPct01(it.stats['Accuracy'])}</div>
            </button>
          )}
          emptyPlaceholder={
            scenarios.length === 0 ? (
              <div className="p-3 text-sm text-secondary">Play a scenario in KovaaK's to see its stats here. Make sure your stats are being saved to the <code className="font-mono">{prettyPath}</code> folder.</div>
            ) : (
              <div className="p-3 text-sm text-secondary">No scenarios match your filters.</div>
            )
          }
          detailHeader={active ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-base font-medium text-primary truncate" title={String(active.stats['Scenario'] ?? getScenarioName(active))}>
                {active.stats['Scenario'] ?? getScenarioName(active)}
              </div>
              <button
                className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-primary text-primary hover:bg-surface-3"
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
  const [sp, setSp] = useSearchParams()
  useEffect(() => {
    // Keep tab in sync with URL if present
    const t = sp.get('tab')
    if (t && (t === 'raw' || t === 'analysis' || t === 'mouse' || t === 'ai')) {
      setTab(t as any)
    }
  }, [sp])
  if (!item) return <div className="p-8 text-center text-secondary">Select a scenario to view details</div>
  const tabs = [
    { id: 'raw', label: 'Raw Stats', content: <RawTab item={item} /> },
    { id: 'analysis', label: 'Analysis', content: <AnalysisTab item={item} /> },
    { id: 'mouse', label: 'Mouse Trace', content: <MouseTraceTab item={item} /> },
    { id: 'ai', label: 'AI Insights', content: <AiTab /> },
  ]
  return <Tabs tabs={tabs} active={tab} onChange={(id) => { setTab(id as any); const p = new URLSearchParams(sp); p.set('tab', String(id)); setSp(p) }} />
}

export default ScenariosPage

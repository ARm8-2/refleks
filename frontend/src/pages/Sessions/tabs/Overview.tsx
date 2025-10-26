import { useEffect, useMemo, useState } from 'react'
import { ChartBox, Findings, MetricsControls, MetricsLineChart, ScenarioMixRadarChart, SummaryStats } from '../../../components'
import { getScenarioName } from '../../../lib/utils'
import type { Session } from '../../../types/domain'

export function OverviewTab({ session }: { session: Session | null }) {
  const items = session?.items ?? []
  // Group per scenario name and collect metrics (newest -> oldest order)
  const byName = useMemo(() => {
    const m = new Map<string, { score: number[]; acc: number[]; ttk: number[] }>()
    for (const it of items) {
      const name = getScenarioName(it)
      const score = Number(it.stats['Score'] ?? 0)
      const accRaw = Number(it.stats['Accuracy'] ?? 0) // 0..1 from backend
      const acc = Number.isFinite(accRaw) ? accRaw * 100 : 0
      const ttk = Number(it.stats['Real Avg TTK'] ?? NaN)
      const prev = m.get(name) ?? { score: [], acc: [], ttk: [] }
      prev.score.push(Number.isFinite(score) ? score : 0)
      prev.acc.push(Number.isFinite(acc) ? acc : 0)
      prev.ttk.push(Number.isFinite(ttk) ? ttk : 0)
      m.set(name, prev)
    }
    return m
  }, [items])

  const names = useMemo(() => Array.from(byName.keys()), [byName])
  const [selectedName, setSelectedName] = useState(names[0] ?? '')
  const [autoSelectLast, setAutoSelectLast] = useState(true)
  // Windowed comparison percentages for trend deltas
  const [firstPct, setFirstPct] = useState<number>(30)
  const [lastPct, setLastPct] = useState<number>(30)

  // When auto-select is enabled, follow the last played scenario name
  useEffect(() => {
    if (!autoSelectLast || items.length === 0) return
    const last = items[0] // items sorted newest first within session
    const name = getScenarioName(last)
    setSelectedName(name)
  }, [autoSelectLast, items])

  useEffect(() => {
    if (!names.includes(selectedName) && names.length > 0) {
      setSelectedName(names[0])
    }
  }, [names, selectedName])

  const metrics = byName.get(selectedName) ?? { score: [], acc: [], ttk: [] }
  // Labels oldest -> newest, data reversed to match labels
  const labels = metrics.score.map((_, i) => `#${metrics.score.length - i}`)
  const scoreSeries = [...metrics.score].reverse()
  const accSeries = [...metrics.acc].reverse()
  const ttkSeries = [...metrics.ttk].reverse()

  // Scenario counts for radar chart (top N by frequency)
  const radar = useMemo(() => {
    const rows = Array.from(byName.entries()).map(([name, v]) => ({ name, count: v.score.length }))
    rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const TOP_N = 12
    const top = rows.slice(0, TOP_N)
    return {
      labels: top.map(r => r.name),
      counts: top.map(r => r.count),
      total: items.length,
      shown: top.length,
    }
  }, [byName, items.length])

  return (
    <div className="space-y-3">
      {/* Global controls for this tab */}
      <MetricsControls
        names={names}
        selectedName={selectedName}
        onSelect={(v) => { setSelectedName(v); setAutoSelectLast(false) }}
        autoSelectLast={autoSelectLast}
        onToggleAuto={setAutoSelectLast}
        firstPct={firstPct}
        lastPct={lastPct}
        onFirstPct={setFirstPct}
        onLastPct={setLastPct}
      />

      <ChartBox
        title="Score, Accuracy and Real Avg TTK"
        info={<div>
          <div className="mb-2">Metrics for the selected scenario within this session. Latest point is the most recent run.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Score uses the left axis.</li>
            <li>Accuracy (%) and Real Avg TTK (s) use their own right axes.</li>
          </ul>
        </div>}
      >
        <MetricsLineChart labels={labels} score={scoreSeries} acc={accSeries} ttk={ttkSeries} />
      </ChartBox>

      <SummaryStats score={metrics.score} acc={metrics.acc} ttk={metrics.ttk} firstPct={firstPct} lastPct={lastPct} />

      {/* Findings: best/worst runs for this scenario in this session */}
      <Findings items={items.filter(it => getScenarioName(it) === selectedName)} />

      {/* Radar chart: scenario mix in this session */}
      <ChartBox
        title="Session mix (scenarios played)"
        info={<div>
          <div className="mb-2">Number of runs per scenario name within this session. Useful to see what you’ve been practicing.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Shows up to the top 12 scenarios by frequency for readability.</li>
            <li>Values start at zero and reflect raw counts.</li>
          </ul>
        </div>}
        height={340}
      >
        {radar.labels.length > 0 ? (
          <ScenarioMixRadarChart labels={radar.labels} counts={radar.counts} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">No scenarios in this session.</div>
        )}
      </ChartBox>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ChartBox, Findings, MetricsControls, MetricsLineChart, ScenarioMixRadarChart, SummaryStats } from '../../../components'
import { buildRankDefs, cellFill, hexToRgba, numberFmt } from '../../../components/benchmarks/utils'
import { useOpenedBenchmarkProgress } from '../../../hooks/useOpenedBenchmarkProgress'
import { useRoute } from '../../../hooks/useRoute'
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

  // Opened benchmark and progress (shared hook)
  const { query } = useRoute()
  const { selectedBenchId, bench, difficultyIndex: benchDifficultyIdx, progress: benchProgress, loading: benchLoading, error: benchError } = useOpenedBenchmarkProgress({ id: query.b || null })

  // Locate scenario progress in the opened benchmark
  const scenarioProgress = useMemo(() => {
    if (!benchProgress || !selectedName) return null
    const categories = benchProgress.categories as Record<string, any> | undefined
    if (!categories || typeof categories !== 'object') return null
    for (const catName of Object.keys(categories)) {
      const cat = categories[catName]
      const scenMap = cat?.scenarios as Record<string, any> | undefined
      if (scenMap && selectedName in scenMap) {
        return { catName, data: scenMap[selectedName] as any }
      }
    }
    return null
  }, [benchProgress, selectedName])

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

      {/* Benchmark progress for the selected scenario (if available) */}
      <ChartBox
        title="Benchmark progress for this scenario"
        info={<div>
          <div className="mb-2">Shows your progress towards benchmark ranks for the currently selected scenario. This follows the benchmark you have open on the Benchmarks page.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Open a benchmark in the Benchmarks tab to display its progress here.</li>
            <li>If this scenario isn’t part of the opened benchmark, an info message is shown.</li>
          </ul>
        </div>}
        height={125}
      >
        <div className="h-full overflow-x-auto">
          {(!selectedBenchId) && (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
              Open a benchmark in “Benchmarks” to see progress for this scenario here.
            </div>
          )}
          {(selectedBenchId && benchError) && (
            <div className="h-full flex items-center justify-center text-sm text-red-400">{benchError}</div>
          )}
          {(selectedBenchId && benchLoading) && (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">Loading benchmark progress…</div>
          )}
          {(selectedBenchId && !benchLoading && !benchError) && (
            bench && benchProgress && scenarioProgress ? (
              <div className="p-1">
                {(() => {
                  const difficulty = bench.difficulties[Math.min(Math.max(0, benchDifficultyIdx), bench.difficulties.length - 1)]
                  const ranks = buildRankDefs(difficulty, benchProgress)
                  const cols = `minmax(220px,1fr) 90px ${Array.from({ length: ranks.length }).map(() => '120px').join(' ')}`
                  const achieved = Number(scenarioProgress.data?.scenario_rank || 0)
                  const maxes: number[] = Array.isArray(scenarioProgress.data?.rank_maxes) ? scenarioProgress.data.rank_maxes : []
                  const raw = Number(scenarioProgress.data?.score || 0)
                  const score = raw / 100
                  return (
                    <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Scenario</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                      {ranks.map((r: { name: string; color: string }) => (
                        <div key={r.name} className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">{r.name}</div>
                      ))}
                      <div className="text-[13px] text-[var(--text-primary)] truncate flex items-center">{selectedName}</div>
                      <div className="text-[12px] text-[var(--text-primary)] flex items-center">{numberFmt(score)}</div>
                      {ranks.map((r: { name: string; color: string }, i: number) => {
                        const fill = cellFill(i, achieved, score, maxes)
                        const border = r.color
                        const value = maxes?.[i]
                        return (
                          <div key={r.name + i} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden flex items-center justify-center" style={{ border: `1px solid ${border}` }}>
                            <div className="absolute inset-y-0 left-0" style={{ width: `${Math.round(fill * 100)}%`, background: hexToRgba(r.color, 0.35) }} />
                            <span className="relative z-10">{value != null ? numberFmt(value) : '—'}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                {bench && benchProgress ? 'This scenario isn’t part of the opened benchmark.' : 'Open a benchmark in “Benchmarks” to see progress for this scenario here.'}
              </div>
            )
          )}
        </div>
      </ChartBox>

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

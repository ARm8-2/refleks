import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChartBox, Findings, MetricsControls, MetricsLineChart, PerformanceVsSensChart, ScenarioBenchmarkProgress, ScenarioMixRadarChart, SummaryStats } from '../../../components'
import { useOpenedBenchmarkProgress } from '../../../hooks/useOpenedBenchmarkProgress'
import { usePageState } from '../../../hooks/usePageState'
import { useUIState } from '../../../hooks/useUIState'
import { computeFindings } from '../../../lib/analysis/findings'
import { buildChartSeries, groupByScenario } from '../../../lib/analysis/metrics'
import { getScenarioName } from '../../../lib/utils'
import type { Session } from '../../../types/domain'

type OverviewTabProps = { session: Session | null }

export function OverviewTab({ session }: OverviewTabProps) {
  const items = session?.items ?? []
  // Group per scenario name and collect metrics (newest -> oldest order)
  const byName = useMemo(() => groupByScenario(items), [items])

  const names = useMemo(() => Array.from(byName.keys()), [byName])
  const [selectedName, setSelectedName] = usePageState<string>('overview:selectedName', names[0] ?? '')
  const [autoSelectLast, setAutoSelectLast] = usePageState<boolean>('overview:autoSelectLast', true)
  // Windowed comparison percentages for trend deltas
  const [firstPct, setFirstPct] = usePageState<number>('overview:firstPct', 30)
  const [lastPct, setLastPct] = usePageState<number>('overview:lastPct', 30)

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
  const { labels, score: scoreSeries, acc: accSeries, ttk: ttkSeries } = buildChartSeries(metrics)
  const [historyLimit, setHistoryLimit] = usePageState<string>('overview:historyLimit', 'all')

  const limitedSeries = useMemo(() => {
    if (!labels || historyLimit === 'all') return { labels, scoreSeries, accSeries, ttkSeries }
    const n = parseInt(historyLimit || '0', 10)
    if (!isFinite(n) || n <= 0) return { labels, scoreSeries, accSeries, ttkSeries }
    const start = Math.max(0, labels.length - n)
    return {
      labels: labels.slice(start),
      scoreSeries: scoreSeries.slice(start),
      accSeries: accSeries.slice(start),
      ttkSeries: ttkSeries.slice(start),
    }
  }, [labels, scoreSeries, accSeries, ttkSeries, historyLimit])

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
  const [sp] = useSearchParams()
  const [openBenchId] = useUIState<string | null>('global:openBenchmark', null)
  const selId = sp.get('b') || openBenchId || null
  const { selectedBenchId, bench, difficultyIndex: benchDifficultyIdx, progress: benchProgress, loading: benchLoading, error: benchError } = useOpenedBenchmarkProgress({ id: selId })

  // Scenario progress UI is encapsulated in its own component below

  const selectedItems = useMemo(() => items.filter(it => getScenarioName(it) === selectedName), [items, selectedName])
  const { strongest, weakest } = useMemo(() => computeFindings(selectedItems), [selectedItems])

  return (
    <div className="space-y-3">
      {/* Global controls for this tab */}
      <MetricsControls
        names={names}
        selectedName={selectedName}
        onSelect={(v) => { setSelectedName(v); setAutoSelectLast(false) }}
        autoSelectLast={autoSelectLast}
        onToggleAuto={setAutoSelectLast}
      />

      <ChartBox
        title="Score, Accuracy and Real Avg TTK"
        controls={{
          dropdown: {
            label: 'Points',
            value: historyLimit,
            onChange: (v: string) => setHistoryLimit(v),
            options: [
              { label: 'All', value: 'all' },
              { label: '5', value: '5' },
              { label: '10', value: '10' },
              { label: '20', value: '20' },
              { label: '50', value: '50' },
            ],
          },
        }}
        info={<div>
          <div className="mb-2">Metrics for the selected scenario within this session. Latest point is the most recent run.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Score uses the left axis.</li>
            <li>Accuracy (%) and Real Avg TTK (s) use their own right axes.</li>
          </ul>
        </div>}
      >
        <MetricsLineChart labels={limitedSeries.labels} score={limitedSeries.scoreSeries} acc={limitedSeries.accSeries} ttk={limitedSeries.ttkSeries} />
      </ChartBox>

      <SummaryStats score={metrics.score} acc={metrics.acc} ttk={metrics.ttk} firstPct={firstPct} lastPct={lastPct} onFirstPct={setFirstPct} onLastPct={setLastPct} />

      {/* Benchmark progress for the selected scenario (if available) */}
      <ScenarioBenchmarkProgress
        bench={bench || null}
        progress={benchProgress}
        scenarioName={selectedName}
        selectedBenchId={selectedBenchId}
        loading={benchLoading}
        error={benchError}
      />

      {/* Findings: best/worst runs for this scenario in this session */}
      <Findings strongest={strongest} weakest={weakest} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PerformanceVsSensChart items={items} scenarioName={selectedName} />
        <ChartBox
          title="Session mix (scenarios played)"
          info={<div>
            <div className="mb-2">Number of runs per scenario name within this session. Useful to see what you’ve been practicing.</div>
            <ul className="list-disc pl-5 text-[var(--text-secondary)]">
              <li>Shows up to the top 12 scenarios by frequency for readability.</li>
              <li>Values start at zero and reflect raw counts.</li>
            </ul>
          </div>}
          height={300}
        >
          {radar.labels.length > 0 ? (
            <ScenarioMixRadarChart labels={radar.labels} counts={radar.counts} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">No scenarios in this session.</div>
          )}
        </ChartBox>
      </div>
    </div>
  )
}

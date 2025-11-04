import { useEffect, useMemo } from 'react'
import { ChartBox, MetricsControls, MetricsLineChart, NextHighscoreForecast, PerformanceVsSensChart, SessionLengthInsights, SummaryStats, TimeOfDayAreaChart } from '../../../components'
import { usePageState } from '../../../hooks/usePageState'
import { useStore } from '../../../hooks/useStore'
import { predictNextHighscore } from '../../../lib/analysis'
import { buildChartSeries, computeSessionAverages, groupByScenario } from '../../../lib/analysis/metrics'
import { getScenarioName } from '../../../lib/utils'

export function ProgressAllTab() {
  // All scenarios across all sessions (newest first in store)
  const scenarios = useStore(s => s.scenarios)
  const sessions = useStore(s => s.sessions)

  // Group per scenario name and collect metrics (newest -> oldest order)
  const byName = useMemo(() => groupByScenario(scenarios), [scenarios])

  const names = useMemo(() => Array.from(byName.keys()), [byName])
  const [selectedName, setSelectedName] = usePageState<string>('progressAll:selectedName', names[0] ?? '')
  const [autoSelectLast, setAutoSelectLast] = usePageState<boolean>('progressAll:autoSelectLast', true)
  const [mode, setMode] = usePageState<'scenarios' | 'sessions'>('progressAll:mode', 'scenarios')
  // Windowed comparison percentages for trend deltas
  const [firstPct, setFirstPct] = usePageState<number>('progressAll:firstPct', 30)
  const [lastPct, setLastPct] = usePageState<number>('progressAll:lastPct', 30)

  // Follow last played scenario name globally when auto-select is enabled
  useEffect(() => {
    if (!autoSelectLast || scenarios.length === 0) return
    const last = scenarios[0] // newest first in store
    const name = getScenarioName(last)
    setSelectedName(name)
  }, [autoSelectLast, scenarios])

  // Ensure selected name is valid
  useEffect(() => {
    if (!names.includes(selectedName) && names.length > 0) {
      setSelectedName(names[0])
    }
  }, [names, selectedName])

  const metricsRuns = byName.get(selectedName) ?? { score: [], acc: [], ttk: [] }
  const metricsSessions = useMemo(() => computeSessionAverages(sessions, selectedName), [sessions, selectedName])

  const metrics = mode === 'sessions' ? metricsSessions : metricsRuns
  // Labels oldest -> newest, data reversed to match labels
  const { labels, score: scoreSeries, acc: accSeries, ttk: ttkSeries } = buildChartSeries(metrics)
  const [historyLimit, setHistoryLimit] = usePageState<string>('progressAll:historyLimit', 'all')

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

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--text-secondary)]">
        This tab shows your overall progress across all recorded runs. It’s the same for every session and updates live as you play.
      </div>

      <MetricsControls
        names={names}
        selectedName={selectedName}
        onSelect={(v) => { setSelectedName(v); setAutoSelectLast(false) }}
        autoSelectLast={autoSelectLast}
        onToggleAuto={setAutoSelectLast}
        mode={mode}
        onModeChange={setMode}
      />

      <ChartBox
        title="Score, Accuracy and Real Avg TTK (all-time)"
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
          <div className="mb-2">Metrics for the selected scenario across all your recorded runs. In Sessions view, values are averaged per session. Latest point is the most recent.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Score uses the left axis.</li>
            <li>Accuracy (%) and Real Avg TTK (s) use their own right axes.</li>
          </ul>
        </div>}
      >
        <MetricsLineChart labels={limitedSeries.labels} score={limitedSeries.scoreSeries} acc={limitedSeries.accSeries} ttk={limitedSeries.ttkSeries} />
      </ChartBox>

      <SummaryStats title="Progress summary" score={metrics.score} acc={metrics.acc} ttk={metrics.ttk} firstPct={firstPct} lastPct={lastPct} onFirstPct={setFirstPct} onLastPct={setLastPct} />

      <NextHighscoreForecast pred={useMemo(() => predictNextHighscore(scenarios, selectedName), [scenarios, selectedName])} />

      <SessionLengthInsights sessions={sessions} scenarioName={selectedName} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PerformanceVsSensChart items={scenarios} scenarioName={selectedName} />
        <ChartBox
          title="Practice time-of-day"
          info={<div>
            <div className="mb-2">Distribution of your practice runs by hour of day. Useful to spot when you train most often.</div>
            <ul className="list-disc pl-5 text-[var(--text-secondary)]">
              <li>Computed from each run’s “Challenge Start” time (local clock).</li>
            </ul>
          </div>}
          height={300}
        >
          <div className="h-full">
            <TimeOfDayAreaChart items={scenarios} />
          </div>
        </ChartBox>
      </div>
    </div>
  )
}

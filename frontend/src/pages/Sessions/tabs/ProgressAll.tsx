import { useEffect, useMemo, useState } from 'react'
import { ChartBox, MetricsControls, MetricsLineChart, SummaryStats, TimeOfDayAreaChart } from '../../../components'
import { useStore } from '../../../hooks/useStore'
import { buildChartSeries, computeSessionAverages, groupByScenario } from '../../../lib/metrics'
import { getScenarioName } from '../../../lib/utils'

export function ProgressAllTab() {
  // All scenarios across all sessions (newest first in store)
  const scenarios = useStore(s => s.scenarios)
  const sessions = useStore(s => s.sessions)

  // Group per scenario name and collect metrics (newest -> oldest order)
  const byName = useMemo(() => groupByScenario(scenarios), [scenarios])

  const names = useMemo(() => Array.from(byName.keys()), [byName])
  const [selectedName, setSelectedName] = useState(names[0] ?? '')
  const [autoSelectLast, setAutoSelectLast] = useState(true)
  const [mode, setMode] = useState<'scenarios' | 'sessions'>('scenarios')
  // Windowed comparison percentages for trend deltas
  const [firstPct, setFirstPct] = useState<number>(30)
  const [lastPct, setLastPct] = useState<number>(30)

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
        firstPct={firstPct}
        lastPct={lastPct}
        onFirstPct={setFirstPct}
        onLastPct={setLastPct}
        mode={mode}
        onModeChange={setMode}
      />

      <ChartBox
        title="Score, Accuracy and Real Avg TTK (all-time)"
        info={<div>
          <div className="mb-2">Metrics for the selected scenario across all your recorded runs. In Sessions view, values are averaged per session. Latest point is the most recent.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Score uses the left axis.</li>
            <li>Accuracy (%) and Real Avg TTK (s) use their own right axes.</li>
          </ul>
        </div>}
      >
        <MetricsLineChart labels={labels} score={scoreSeries} acc={accSeries} ttk={ttkSeries} />
      </ChartBox>

      <SummaryStats title="Progress summary" score={metrics.score} acc={metrics.acc} ttk={metrics.ttk} firstPct={firstPct} lastPct={lastPct} />

      <ChartBox
        title="Practice time-of-day"
        info={<div>
          <div className="mb-2">Distribution of your practice runs by hour of day. Useful to spot when you train most often.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Computed from each run’s “Challenge Start” time (local clock).</li>
            <li>Shaded area highlights the volume under the curve.</li>
          </ul>
        </div>}
        height={260}
      >
        <div className="h-full">
          <TimeOfDayAreaChart items={scenarios} />
        </div>
      </ChartBox>
    </div>
  )
}

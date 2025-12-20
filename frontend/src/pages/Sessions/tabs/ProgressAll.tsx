import { useEffect, useMemo } from 'react';
import { MetricsControls } from '../../../components/sessions/MetricsControls';
import { PerformanceVsSensChart } from '../../../components/sessions/PerformanceVsSensChart';
import { SessionLengthRecommendation } from '../../../components/sessions/SessionLengthRecommendation';
import { SessionMetricsChart } from '../../../components/sessions/SessionMetricsChart';
import { SummaryStats } from '../../../components/sessions/SummaryStats';
import { TimeOfDayAreaChart } from '../../../components/sessions/TimeOfDayAreaChart';
import { usePageState } from '../../../hooks/usePageState';
import { useStore } from '../../../hooks/useStore';
import { computeSessionAverages, groupByScenario } from '../../../lib/analysis/metrics';
import { getScenarioName } from '../../../lib/utils';

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

  const infoContent = (
    <div>
      <div className="mb-2">Metrics for the selected scenario across all your recorded runs. In Sessions view, values are averaged per session. Latest point is the most recent.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Score uses the left axis.</li>
        <li>Accuracy (%) and Real Avg TTK (s) use their own right axes.</li>
      </ul>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="text-xs text-secondary">
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

      <SessionMetricsChart
        metrics={metrics}
        title="Score, Accuracy and Real Avg TTK (all-time)"
        info={infoContent}
        storageKeyPrefix="progressAll"
        modalControls={
          <MetricsControls
            names={names}
            selectedName={selectedName}
            onSelect={(v) => { setSelectedName(v); setAutoSelectLast(false) }}
            autoSelectLast={autoSelectLast}
            onToggleAuto={setAutoSelectLast}
            mode={mode}
            onModeChange={setMode}
          />
        }
      />

      <SummaryStats title="Progress summary" score={metrics.score} acc={metrics.acc} ttk={metrics.ttk} storageKeyPrefix="progressAll" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PerformanceVsSensChart items={scenarios} scenarioName={selectedName} />
        <TimeOfDayAreaChart items={scenarios} />
      </div>

      <SessionLengthRecommendation sessions={sessions} />
    </div>
  )
}

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DailyActivity } from '../../../components/sessions/DailyActivity';
import { FatigueAlert } from '../../../components/sessions/FatigueAlert';
import { Findings } from '../../../components/sessions/Findings';
import { MetricsControls } from '../../../components/sessions/MetricsControls';
import { PerformanceVsSensChart } from '../../../components/sessions/PerformanceVsSensChart';
import { ScenarioBenchmarkProgress } from '../../../components/sessions/ScenarioBenchmarkProgress';
import { SessionMetricsChart } from '../../../components/sessions/SessionMetricsChart';
import { SessionMixChart } from '../../../components/sessions/SessionMixChart';
import { SessionStatus } from '../../../components/sessions/SessionStatus';
import { SummaryStats } from '../../../components/sessions/SummaryStats';
import { useOpenedBenchmarkProgress } from '../../../hooks/useOpenedBenchmarkProgress';
import { usePageState } from '../../../hooks/usePageState';
import { useStore } from '../../../hooks/useStore';
import { useUIState } from '../../../hooks/useUIState';
import { computeFindings } from '../../../lib/analysis/findings';
import { groupByScenario } from '../../../lib/analysis/metrics';
import { analyzeSessionHealth, buildScenarioProfiles, recommendSessionLength } from '../../../lib/analysis/session';
import { getScenarioName } from '../../../lib/utils';
import type { Session } from '../../../types/domain';

type OverviewTabProps = { session: Session | null }

export function OverviewTab({ session }: OverviewTabProps) {
  const items = session?.items ?? []
  const allSessions = useStore(s => s.sessions)

  // Pre-calculate session analysis to avoid double computation in child components
  const profiles = useMemo(() => buildScenarioProfiles(allSessions), [allSessions])
  const analysis = useMemo(
    () => analyzeSessionHealth(session, allSessions, profiles),
    [session, allSessions, profiles]
  )
  const recommendation = useMemo(
    () => recommendSessionLength(allSessions, profiles),
    [allSessions, profiles]
  )

  // Group per scenario name and collect metrics (newest -> oldest order)
  const byName = useMemo(() => groupByScenario(items), [items])

  const names = useMemo(() => Array.from(byName.keys()), [byName])
  const [selectedName, setSelectedName] = usePageState<string>('overview:selectedName', names[0] ?? '')
  const [autoSelectLast, setAutoSelectLast] = usePageState<boolean>('overview:autoSelectLast', true)

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

  // Opened benchmark and progress (shared hook)
  const [sp] = useSearchParams()
  const [openBenchId] = useUIState<string | null>('global:openBenchmark', null)
  const selId = sp.get('b') || openBenchId || null
  const { selectedBenchId, bench, difficultyIndex: benchDifficultyIdx, progress: benchProgress, loading: benchLoading, error: benchError } = useOpenedBenchmarkProgress({ id: selId })

  // Scenario progress UI is encapsulated in its own component below

  const selectedItems = useMemo(() => items.filter(it => getScenarioName(it) === selectedName), [items, selectedName])
  const { strongest, weakest } = useMemo(() => computeFindings(selectedItems), [selectedItems])

  const infoContent = (
    <div>
      <div className="mb-2">Metrics for the selected scenario within this session. Latest point is the most recent run.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Score uses the left axis.</li>
        <li>Accuracy (%) and Real Avg TTK (s) use their own right axes.</li>
      </ul>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Fatigue detection alert - shows when performance decline detected */}
      <FatigueAlert currentSession={session} analysis={analysis} />

      {/* Quick session status bar */}
      <div className="flex flex-wrap gap-3 w-full">
        <SessionStatus currentSession={session} analysis={analysis} recommendation={recommendation} />
        <DailyActivity currentSession={session} allSessions={allSessions} />
      </div>

      {/* Global controls for this tab */}
      <MetricsControls
        names={names}
        selectedName={selectedName}
        onSelect={(v) => { setSelectedName(v); setAutoSelectLast(false) }}
        autoSelectLast={autoSelectLast}
        onToggleAuto={setAutoSelectLast}
      />

      <SessionMetricsChart
        metrics={metrics}
        title="Score, Accuracy and Real Avg TTK"
        info={infoContent}
        storageKeyPrefix="overview"
        modalControls={
          <MetricsControls
            names={names}
            selectedName={selectedName}
            onSelect={(v) => { setSelectedName(v); setAutoSelectLast(false) }}
            autoSelectLast={autoSelectLast}
            onToggleAuto={setAutoSelectLast}
          />
        }
      />

      <SummaryStats score={metrics.score} acc={metrics.acc} ttk={metrics.ttk} storageKeyPrefix="overview" />

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
        <SessionMixChart items={items} />
      </div>
    </div>
  )
}

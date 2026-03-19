
import { HistoryRunDetailPane } from '../components/HistoryRunDetailPane'
import { HistoryRunList } from '../components/HistoryRunList'
import { HistorySessionOverview } from '../components/HistorySessionOverview'
import { HistorySessionSidebar } from '../components/HistorySessionSidebar'
import { useHistoryPageState } from '../hooks/useHistoryPageState'

export function HistoryPage() {
  const {
    sessions,
    filteredSessions,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    sessionQuery,
    setSessionQuery,
    sessionListCollapsed,
    setSessionListCollapsed,
    sessionSort,
    setSessionSort,
    sessionFilterPb,
    setSessionFilterPb,
    runQuery,
    setRunQuery,
    sessionRuns,
    filteredSessionRuns,
    runInspectorOpen,
    setRunInspectorOpen,
    runListCollapsed,
    setRunListCollapsed,
    runSort,
    setRunSort,
    runFilterPb,
    setRunFilterPb,
    inspectorTab,
    setInspectorTab,
    selectedScenario,
    setSelectedScenario,
    primaryRun,
    compareRun,
    pbRunForPrimary,
    globalPbByScenario,
    selectRun,
    compareRunWithPrimary,
    comparePb,
    clearPrimaryRun,
    clearComparison,
  } = useHistoryPageState()

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-sm">
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:p-5">
        <HistorySessionSidebar
          sessions={filteredSessions}
          selectedSessionId={selectedSessionId}
          collapsed={sessionListCollapsed}
          query={sessionQuery}
          onQueryChange={setSessionQuery}
          onSelectSession={setSelectedSessionId}
          onToggleCollapsed={() => setSessionListCollapsed(v => !v)}
          sort={sessionSort}
          onSortChange={setSessionSort}
          filterPb={sessionFilterPb}
          onFilterPbChange={setSessionFilterPb}
        />

        {/* Main content area: session overview or inspector */}
        <div className="min-h-0 min-w-0 flex-1">
          {runInspectorOpen ? (
            <HistoryRunDetailPane
              primaryRun={primaryRun}
              compareRun={compareRun}
              activeTab={inspectorTab}
              onTabChange={setInspectorTab}
              onClose={() => setRunInspectorOpen(false)}
              onClearPrimaryRun={clearPrimaryRun}
              onClearComparison={clearComparison}
              isPrimaryPb={!!primaryRun && !!pbRunForPrimary && primaryRun.id === pbRunForPrimary.id}
              onComparePb={comparePb}
            />
          ) : (
            <HistorySessionOverview
              session={selectedSession}
              sessions={sessions}
              sessionRuns={sessionRuns}
              selectedScenario={selectedScenario}
              onSelectScenario={setSelectedScenario}
              onSelectRun={selectRun}
              globalPbByScenario={globalPbByScenario}
            />
          )}
        </div>

        <HistoryRunList
          session={selectedSession}
          runs={filteredSessionRuns}
          query={runQuery}
          primaryRun={primaryRun}
          compareRun={compareRun}
          collapsed={runListCollapsed}
          inspectorOpen={runInspectorOpen}
          selectedScenario={selectedScenario}
          onQueryChange={setRunQuery}
          onToggleCollapsed={() => setRunListCollapsed(v => !v)}
          onToggleInspector={() => setRunInspectorOpen(v => !v)}
          onSelectRun={selectRun}
          onCompareRun={compareRunWithPrimary}
          sort={runSort}
          onSortChange={setRunSort}
          filterPb={runFilterPb}
          onFilterPbChange={setRunFilterPb}
        />
      </div>
    </div>
  )
}

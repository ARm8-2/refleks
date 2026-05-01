export const STORAGE_KEYS = {
  theme: 'refleks.theme',
  font: 'refleks.font',
  sidebarOpen: 'refleks.sidebar.open',
  navLastPath: 'refleks.nav.lastPath',

  benchmarksSelected: 'refleks.benchmarks.selected',
  benchmarksQuery: 'refleks.benchmarks.query',
  benchmarksFavOnly: 'refleks.benchmarks.favOnly',
  benchmarksShowRecs: 'refleks.benchmarks.showRecs',
  benchmarksSortBy: 'refleks.benchmarks.sortBy',
  benchmarksGroupBy: 'refleks.benchmarks.groupBy',
  benchmarksCollapsed: 'refleks.benchmarks.collapsed',
  benchmarksDetailStrengthLevel: 'refleks.benchmarks.detail.strength.level',
  benchmarksDetailRankDistributionScope: 'refleks.benchmarks.detail.rankDistribution.scope',
  benchmarksDetailRankDistributionCategoryIndex: 'refleks.benchmarks.detail.rankDistribution.categoryIndex',
  benchmarksDetailRankDistributionSubcategoryIndex: 'refleks.benchmarks.detail.rankDistribution.subcategoryIndex',

  historyScenarioGridExpanded: 'refleks.history.scenarioGridExpanded',
  historyScenarioQuery: 'refleks.history.scenarioQuery',
  historyAnalysisOverlay: 'refleks.history.analysisOverlay',
  historySelectedSessionId: 'refleks.history.selectedSessionId',
  historySessionQuery: 'refleks.history.sessionQuery',
  historySessionListCollapsed: 'refleks.history.sessionListCollapsed',
  historyRunQuery: 'refleks.history.runQuery',
  historyRunInspectorOpen: 'refleks.history.runInspectorOpen',
  historyRunListCollapsed: 'refleks.history.runListCollapsed',
  historyInspectorTab: 'refleks.history.inspectorTab',
  historySelectedScenario: 'refleks.history.selectedScenario',
  historyPrimaryRunId: 'refleks.history.primaryRunId',
  historyCompareRunId: 'refleks.history.compareRunId',
  historyRunSort: 'refleks.history.runSort',
  historyRunFilterPb: 'refleks.history.runFilterPb',
  historySessionSort: 'refleks.history.sessionSort',
  historySessionFilterPb: 'refleks.history.sessionFilterPb',

  traceSpeed: 'refleks.trace.speed',
  traceTrail: 'refleks.trace.trail',
  traceFollow: 'refleks.trace.follow',
  traceClicks: 'refleks.trace.clicks',
  traceZoom: 'refleks.trace.zoom',
  traceSyncByTime: 'refleks.trace.syncByTime',

  overviewSessionProgressTargetRuns: 'refleks.overview.sessionProgress.targetRuns',
  overviewRecentScoresRunCount: 'refleks.overview.recentScores.runCount',
  overviewRecentScoresShowSessionBest: 'refleks.overview.recentScores.showSessionBest',
  overviewRecentScoresShowPb: 'refleks.overview.recentScores.showPb',
  overviewStreakRangeDays: 'refleks.overview.streak.rangeDays',
  overviewStreakBreakdownMode: 'refleks.overview.streak.breakdownMode',
  overviewStreakSelectedDayTs: 'refleks.overview.streak.selectedDayTs',
  performanceVsSensMetric: 'refleks.widgets.performanceVsSens.metric',
  performanceVsSensScope: 'refleks.widgets.performanceVsSens.scope',

  settingsShowAdvanced: 'refleks.settings.showAdvanced',
} as const

export type BenchmarkDetailProgressPreference =
  | 'compact'
  | 'showNotes'
  | 'showRec'
  | 'showPlay'
  | 'showHistory'

export type BenchmarkDetailVisibilityPreference =
  | 'autoHide'
  | 'visibleCount'
  | 'manualHidden'

const UNKNOWN_BENCHMARK_STORAGE_NAME = 'unknown'

function benchmarkDetailStorageBase(benchmarkName: string | null | undefined): string {
  const resolvedName = benchmarkName?.trim() || UNKNOWN_BENCHMARK_STORAGE_NAME
  return `refleks.benchmarks.detail.${resolvedName}`
}

export function benchmarkDetailDifficultyStorageKey(benchmarkName: string | null | undefined): string {
  return `${benchmarkDetailStorageBase(benchmarkName)}.difficulty`
}

export function benchmarkDetailProgressStorageBase(benchmarkName: string | null | undefined): string {
  return `${benchmarkDetailStorageBase(benchmarkName)}.progress`
}

export function benchmarkDetailProgressStorageKey(
  benchmarkName: string | null | undefined,
  preference: BenchmarkDetailProgressPreference,
): string {
  return `${benchmarkDetailProgressStorageBase(benchmarkName)}.${preference}`
}

export function benchmarkDetailVisibilityStorageKey(
  storagePrefix: string,
  preference: BenchmarkDetailVisibilityPreference,
): string {
  return `${storagePrefix}.${preference}`
}

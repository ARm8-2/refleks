import { usePersistedState, useStore } from '@/shared/hooks'
import { STORAGE_KEYS } from '@/shared/lib'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildHistoryRuns, matchRunSearch, matchSessionSearch, readSessionDurationMs } from '../lib/historyModels'
import type { InspectorTab } from '../lib/inspectorTabs'

export type RunSortKey = 'default' | 'score-desc' | 'score-asc' | 'accuracy-desc' | 'scenario'
export type SessionSortKey = 'newest' | 'oldest' | 'most-runs' | 'longest'

export function useHistoryPageState() {
  const sessions = useStore(state => state.sessions)

  const [selectedSessionId, setSelectedSessionId] = usePersistedState<string | null>(STORAGE_KEYS.historySelectedSessionId, null)
  const [sessionQuery, setSessionQuery] = usePersistedState(STORAGE_KEYS.historySessionQuery, '')
  const [sessionListCollapsed, setSessionListCollapsed] = usePersistedState(STORAGE_KEYS.historySessionListCollapsed, false)
  const [runQuery, setRunQuery] = usePersistedState(STORAGE_KEYS.historyRunQuery, '')
  const [runInspectorOpen, setRunInspectorOpen] = usePersistedState(STORAGE_KEYS.historyRunInspectorOpen, false)
  const [runListCollapsed, setRunListCollapsed] = usePersistedState(STORAGE_KEYS.historyRunListCollapsed, false)
  const [inspectorTab, setInspectorTab] = usePersistedState<InspectorTab>(STORAGE_KEYS.historyInspectorTab, 'stats')
  const [selectedScenario, setSelectedScenario] = usePersistedState<string | null>(STORAGE_KEYS.historySelectedScenario, null)
  const [primaryRunId, setPrimaryRunId] = usePersistedState<string | null>(STORAGE_KEYS.historyPrimaryRunId, null)
  const [compareRunId, setCompareRunId] = usePersistedState<string | null>(STORAGE_KEYS.historyCompareRunId, null)
  const [runSort, setRunSort] = usePersistedState<RunSortKey>(STORAGE_KEYS.historyRunSort, 'default')
  const [runFilterPb, setRunFilterPb] = usePersistedState(STORAGE_KEYS.historyRunFilterPb, false)
  const [sessionSort, setSessionSort] = usePersistedState<SessionSortKey>(STORAGE_KEYS.historySessionSort, 'newest')
  const [sessionFilterPb, setSessionFilterPb] = usePersistedState(STORAGE_KEYS.historySessionFilterPb, false)

  const allRuns = useMemo(() => buildHistoryRuns(sessions), [sessions])
  const runsById = useMemo(() => new Map(allRuns.map(run => [run.id, run])), [allRuns])

  const globalPbByScenario = useMemo(() => {
    const map = new Map<string, typeof allRuns[0]>()
    for (const run of allRuns) {
      const current = map.get(run.scenarioName)
      if (!current || run.score > current.score) {
        map.set(run.scenarioName, run)
      }
    }
    return map
  }, [allRuns])

  const selectedSession = useMemo(
    () => sessions.find(session => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [sessions, selectedSessionId],
  )

  useEffect(() => {
    const fallback = sessions[0]?.id ?? null
    const next = selectedSessionId && sessions.some(session => session.id === selectedSessionId)
      ? selectedSessionId
      : fallback

    if (next !== selectedSessionId) {
      setSelectedSessionId(next)
    }
  }, [selectedSessionId, sessions, setSelectedSessionId])

  useEffect(() => {
    if (primaryRunId && !runsById.has(primaryRunId)) {
      setPrimaryRunId(null)
      setCompareRunId(null)
    }
  }, [primaryRunId, runsById, setCompareRunId, setPrimaryRunId])

  useEffect(() => {
    if (!compareRunId) return

    if (!runsById.has(compareRunId) || compareRunId === primaryRunId) {
      setCompareRunId(null)
    }
  }, [compareRunId, primaryRunId, runsById, setCompareRunId])

  const wasInspectorOpen = useRef(runInspectorOpen)
  useEffect(() => {
    if (runInspectorOpen && !wasInspectorOpen.current) {
      setSessionListCollapsed(true)
    }
    if (!runInspectorOpen && wasInspectorOpen.current) {
      setSessionListCollapsed(false)
    }

    wasInspectorOpen.current = runInspectorOpen
  }, [runInspectorOpen, setSessionListCollapsed])

  const filteredSessions = useMemo(
    () => sessions.filter(session => matchSessionSearch(session, sessionQuery)),
    [sessionQuery, sessions],
  )

  const sessionRuns = useMemo(
    () => allRuns.filter(run => run.sessionId === selectedSession?.id),
    [allRuns, selectedSession],
  )

  const filteredSessionRuns = useMemo(
    () => sessionRuns.filter(run => matchRunSearch(run, runQuery)),
    [runQuery, sessionRuns],
  )

  const sortedFilteredRuns = useMemo(() => {
    let runs = filteredSessionRuns

    if (runFilterPb) {
      runs = runs.filter(r => globalPbByScenario.get(r.scenarioName)?.id === r.id)
    }

    if (runSort === 'default') return runs

    const sorted = [...runs]
    switch (runSort) {
      case 'score-desc': sorted.sort((a, b) => b.score - a.score); break
      case 'score-asc': sorted.sort((a, b) => a.score - b.score); break
      case 'accuracy-desc': sorted.sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1)); break
      case 'scenario': sorted.sort((a, b) => a.scenarioName.localeCompare(b.scenarioName) || b.score - a.score); break
    }
    return sorted
  }, [filteredSessionRuns, runSort, runFilterPb, globalPbByScenario])

  const pbSessionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const run of globalPbByScenario.values()) ids.add(run.sessionId)
    return ids
  }, [globalPbByScenario])

  const sortedFilteredSessions = useMemo(() => {
    let list = filteredSessions

    if (sessionFilterPb) {
      list = list.filter(s => pbSessionIds.has(s.id))
    }

    if (sessionSort === 'newest') return list

    const sorted = [...list]
    switch (sessionSort) {
      case 'oldest': sorted.reverse(); break
      case 'most-runs': sorted.sort((a, b) => b.items.length - a.items.length); break
      case 'longest': sorted.sort((a, b) => readSessionDurationMs(b) - readSessionDurationMs(a)); break
    }
    return sorted
  }, [filteredSessions, sessionSort, sessionFilterPb, pbSessionIds])

  const primaryRun = primaryRunId ? runsById.get(primaryRunId) ?? null : null
  const compareRun = compareRunId ? runsById.get(compareRunId) ?? null : null

  const pbRunForPrimary = useMemo(() => {
    if (!primaryRun) return null
    return globalPbByScenario.get(primaryRun.scenarioName) ?? null
  }, [globalPbByScenario, primaryRun])

  const comparePb = useCallback(() => {
    if (!pbRunForPrimary || !primaryRunId || pbRunForPrimary.id === primaryRunId) return
    setRunInspectorOpen(true)
    setCompareRunId(pbRunForPrimary.id)
  }, [pbRunForPrimary, primaryRunId, setCompareRunId, setRunInspectorOpen])

  const selectRun = (runId: string) => {
    setRunInspectorOpen(true)

    if (runId === primaryRunId) return

    if (runId === compareRunId) {
      setPrimaryRunId(runId)
      setCompareRunId(null)
      return
    }

    setPrimaryRunId(runId)
    setCompareRunId(null)
  }

  const compareRunWithPrimary = (runId: string) => {
    if (!primaryRunId || primaryRunId === runId) return
    if (runId === compareRunId) {
      setCompareRunId(null)
      return
    }
    setRunInspectorOpen(true)
    setCompareRunId(runId)
  }

  const clearPrimaryRun = () => {
    setPrimaryRunId(null)
    setCompareRunId(null)
  }

  return {
    sessions,
    filteredSessions: sortedFilteredSessions,
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
    filteredSessionRuns: sortedFilteredRuns,
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
    clearComparison: () => setCompareRunId(null),
  }
}

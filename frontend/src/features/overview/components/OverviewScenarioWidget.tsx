import { ChartLine, NotebookPen, Play, Settings2 } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Checkbox, Loading, Modal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components'
import { useBenchmarks, usePersistedState, useStore } from '../../../shared/hooks'
import { getSettings, launchScenario, saveScenarioNote } from '../../../shared/lib'
import type { ProgressScenario, Settings } from '../../../shared/types'
import { RecommendationIndicator } from '../../benchmarks/components/detail/RecommendationIndicator'
import { ScenarioHistoryModal } from '../../benchmarks/components/detail/ScenarioHistoryModal'
import { ScenarioNotesModal } from '../../benchmarks/components/detail/ScenarioNotesModal'
import { useBenchmarkDetailProgress } from '../../benchmarks/hooks/useBenchmarkDetailProgress'
import { useBenchmarkVisibility } from '../../benchmarks/hooks/useBenchmarkVisibility'
import { useResizableScenarioColumn } from '../../benchmarks/hooks/useResizableScenarioColumn'
import { MISSING_STR } from '../../benchmarks/lib/detailConstants'
import { cellFill, computeFillColor, formatNumber, getScenarioName } from '../../benchmarks/lib/detailFormatting'
import { computeRecommendationScores, selectTopPicks, type ScenarioBenchmarkData } from '../../benchmarks/lib/detailRecommendations'
import { buildLeftColumns, buildRightGridLayout } from '../../benchmarks/lib/detailTableLayout'

function ToggleChip({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${enabled
        ? 'border-primary/50 bg-primary/15 text-primary'
        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
    >
      {label}
    </button>
  )
}

type ScenarioItem = {
  scenario: ProgressScenario
  groupEnergy: number | null
}

export function OverviewScenarioWidget() {
  const { selectedBenchmark, getBenchmarkByName } = useBenchmarks()
  const sessions = useStore(state => state.sessions)

  const benchmark = selectedBenchmark ? getBenchmarkByName(selectedBenchmark) : null
  const { progress, loading, error, difficultyIndex } = useBenchmarkDetailProgress(benchmark ?? undefined)
  const difficultyName = benchmark?.difficulties?.[difficultyIndex]?.difficultyName || 'Unknown difficulty'

  const storageBase = `refleks.overview.scenarioWidget`

  const [compactMode, setCompactMode] = usePersistedState<boolean>(`${storageBase}.compact`, false)
  const [showNotesCol, setShowNotesCol] = usePersistedState<boolean>(`${storageBase}.showNotes`, true)
  const [showRecCol, setShowRecCol] = usePersistedState<boolean>(`${storageBase}.showRec`, true)
  const [showPlayCol, setShowPlayCol] = usePersistedState<boolean>(`${storageBase}.showPlay`, true)
  const [showHistoryCol, setShowHistoryCol] = usePersistedState<boolean>(`${storageBase}.showHistory`, true)
  const [showSettings, setShowSettings] = useState(false)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [notesState, setNotesState] = useState({ open: false, scenario: '', notes: '', sensitivity: '' })
  const [historyState, setHistoryState] = useState({ open: false, scenario: '' })


  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(null))
  }, [])

  const openNotes = (scenario: string) => {
    const note = settings?.scenarioNotes?.[scenario]
    setNotesState({ open: true, scenario, notes: note?.notes || '', sensitivity: note?.sens || '' })
  }

  const saveNotes = async (notes: string, sensitivity: string) => {
    await saveScenarioNote(notesState.scenario, notes, sensitivity)
    setSettings(previous => ({
      ...(previous || {}),
      scenarioNotes: { ...(previous?.scenarioNotes || {}), [notesState.scenario]: { notes, sens: sensitivity } },
    }) as Settings)
  }

  const openHistory = (scenario: string) => setHistoryState({ open: true, scenario })

  const { scenarioWidth, onHandleMouseDown } = useResizableScenarioColumn()

  const {
    rankDefs,
    categories,
    autoHideCleared,
    setAutoHideCleared,
    visibleRankCount,
    setVisibleRankCount,
    manuallyHidden,
    toggleManualRank,
    resetManual,
    autoHidden,
    visibleRankIndices,
    visibleRanks,
  } = useBenchmarkVisibility({ storagePrefix: storageBase, progress })

  const hasEnergy = useMemo(() => {
    for (const category of categories) {
      for (const group of category.groups) {
        if (group.energy != null) return true
        for (const scenario of group.scenarios) {
          if (scenario.energy != null) return true
        }
      }
    }
    return false
  }, [categories])

  const leftColumns = useMemo(() => buildLeftColumns({
    scenarioWidth,
    showNotesCol,
    showRecCol,
    showPlayCol,
    showHistoryCol,
  }), [scenarioWidth, showNotesCol, showRecCol, showPlayCol, showHistoryCol])

  const rightLayout = useMemo(
    () => buildRightGridLayout(visibleRankIndices.length, hasEnergy),
    [visibleRankIndices.length, hasEnergy],
  )

  // Flattened scenarios for easy access
  const allScenarios = useMemo(() => {
    const map = new Map<string, ScenarioItem>()
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          map.set(scenario.name, { scenario, groupEnergy: group.energy ?? null })
        }
      }
    }
    return map
  }, [categories])

  const wantedNames = useMemo(() => Array.from(allScenarios.keys()), [allScenarios])

  const lastSessionCount = useMemo(() => {
    const map = new Map<string, number>()
    const lastSession = sessions[0]
    if (!lastSession) return map
    for (const item of lastSession.items) {
      const name = getScenarioName(item)
      map.set(name, (map.get(name) || 0) + 1)
    }
    return map
  }, [sessions])

  const currentScenarioName = useMemo(() => {
    const lastSession = sessions[0]
    if (!lastSession || !lastSession.items.length) return null
    return getScenarioName(lastSession.items[0])
  }, [sessions])

  const benchmarkData = useMemo(() => {
    const data = new Map<string, ScenarioBenchmarkData>()
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          data.set(scenario.name, {
            rank: Number(scenario.scenarioRank || 0),
            score: Number(scenario.score || 0),
            thresholds: scenario.thresholds || [],
            category: category.name,
          })
        }
      }
    }
    return data
  }, [categories])

  const scenarioCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          map.set(scenario.name, category.name)
        }
      }
    }
    return map
  }, [categories])

  const recommendationScore = useMemo(() => computeRecommendationScores({
    wantedNames,
    lastSessionCount,
    sessions,
    benchmarkData,
  }), [wantedNames, lastSessionCount, sessions, benchmarkData])

  const topPicks = useMemo(() => {
    const picks = selectTopPicks(recommendationScore, scenarioCategoryMap, Math.max(3, categories.length || 3))
    return new Set(Array.from(picks).filter(name => (recommendationScore.get(name) ?? 0) > 0))
  }, [recommendationScore, scenarioCategoryMap, categories.length])

  const recommendedByScore = useMemo(() => {
    return Array.from(recommendationScore.entries())
      .filter(([name, score]) => score > 0 && allScenarios.has(name))
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  }, [recommendationScore, allScenarios])

  const topPicksOrdered = useMemo(
    () => recommendedByScore.filter(name => topPicks.has(name)),
    [recommendedByScore, topPicks],
  )

  const scenariosToDisplay = useMemo(() => {
    const list: ScenarioItem[] = []
    const added = new Set<string>()
    const targetRecommendationCount = 4
    const countRecommendations = () => {
      const hasCurrent = Boolean(currentScenarioName && added.has(currentScenarioName))
      return list.length - (hasCurrent ? 1 : 0)
    }

    if (currentScenarioName && allScenarios.has(currentScenarioName)) {
      list.push(allScenarios.get(currentScenarioName)!)
      added.add(currentScenarioName)
    }

    for (const pick of topPicksOrdered) {
      if (!added.has(pick) && allScenarios.has(pick)) {
        list.push(allScenarios.get(pick)!)
        added.add(pick)
      }
    }

    const recommendationCount = countRecommendations()
    if (recommendationCount < targetRecommendationCount) {
      for (const name of recommendedByScore) {
        if (!added.has(name) && allScenarios.has(name)) {
          list.push(allScenarios.get(name)!)
          added.add(name)
        }
        const currentCount = countRecommendations()
        if (currentCount >= targetRecommendationCount) break
      }
    }

    return list
  }, [currentScenarioName, allScenarios, topPicksOrdered, recommendedByScore])

  const showCurrentSeparator =
    Boolean(currentScenarioName)
    && scenariosToDisplay.length > 1
    && scenariosToDisplay[0]?.scenario.name === currentScenarioName

  if (!benchmark) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center space-y-3">
        <p className="text-sm text-muted-foreground">Select a benchmark on the Benchmarks page to start tracking progress.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/benchmarks">Go to Benchmarks</Link>
        </Button>
      </div>
    )
  }

  if (loading) return <Loading />
  if (error) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
  if (!progress) return (
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
      No scenario data available for {benchmark.benchmarkName}.
    </div>
  )

  if (scenariosToDisplay.length === 0) return (
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
      No recommended scenarios available right now for {benchmark.benchmarkName}.
    </div>
  )

  return (
    <section className="relative z-0 min-w-0 isolate rounded-xl bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Active Benchmark Progress</h3>
          <p className="text-xs text-muted-foreground">
            {benchmark.abbreviation} {benchmark.benchmarkName} · {difficultyName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip label="Compact" enabled={compactMode} onToggle={() => setCompactMode((value: boolean) => !value)} />
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="View settings">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="relative z-0 overflow-x-auto rounded-xl"
      >
        <div className="w-max min-w-full space-y-3 pb-4">
          <div className="relative z-[30] rounded-xl bg-card py-2.5 pr-2">
            <div className="flex items-center">
              <div className="sticky left-0 z-20 shrink-0 bg-card pl-5 shadow-[12px_0_12px_-6px_rgba(0,0,0,0.1)] pr-2">
                <div className="grid gap-1" style={{ gridTemplateColumns: leftColumns }}>
                  <div className="relative select-none text-[11px] uppercase tracking-wide text-muted-foreground" style={{ width: scenarioWidth }}>
                    <span>Scenario</span>
                    <div
                      onMouseDown={onHandleMouseDown}
                      className="group absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize scenario column"
                    >
                      <div className="h-full w-px bg-border group-hover:bg-primary" />
                    </div>
                  </div>
                  <div />
                  {showNotesCol && <div />}
                  {showRecCol && <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">Rec</div>}
                  {showPlayCol && <div />}
                  {showHistoryCol && <div />}
                  <div />
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</div>
                </div>
              </div>

              <div className="ml-2 flex-1">
                <div className="grid gap-1" style={{ gridTemplateColumns: rightLayout.templateColumns, minWidth: rightLayout.minWidth, width: '100%' }}>
                  {visibleRanks.map(rank => (
                    <div
                      key={rank.name}
                      className="text-center text-[11px] uppercase tracking-wide"
                      style={rank.color ? { color: rank.color } : { color: 'hsl(var(--muted-foreground))' }}
                    >
                      {rank.name}
                    </div>
                  ))}
                  {hasEnergy && <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">Energy</div>}
                  {!visibleRanks.length && !hasEnergy && <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">Details</div>}
                </div>
              </div>
            </div>
          </div>

          <div className={`min-w-max rounded-xl bg-card pr-2 ${compactMode ? 'py-3' : 'py-4'}`}>
            <div className={`${compactMode ? 'space-y-1.5' : 'space-y-3'}`}>
              {scenariosToDisplay.map(({ scenario, groupEnergy }, index) => {
                const recommendation = recommendationScore.get(scenario.name) ?? 0
                const isTopPick = topPicks.has(scenario.name)
                const isCompleted = scenario.scenarioRank >= (scenario.thresholds.length - 1)
                const rankColor = computeFillColor(scenario.scenarioRank, rankDefs)

                return (
                  <Fragment key={scenario.name}>
                    <div className="flex">
                      <div className="sticky left-0 z-20 shrink-0 bg-card pl-5 pr-2 shadow-[12px_0_12px_-6px_rgba(0,0,0,0.1)]">
                        <div className="grid gap-1 items-center" style={{ gridTemplateColumns: leftColumns }}>
                          <div className={`${compactMode ? 'text-[11px]' : 'text-[13px]'} min-w-0 flex items-center text-foreground`}>
                            <div className="mr-2 h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: rankColor }} />
                            <span className="truncate">{scenario.name}</span>
                          </div>
                          <div />

                          {showNotesCol && (
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                className={`${compactMode ? 'p-0.5' : 'p-1'} rounded-lg border border-transparent transition-colors hover:border-border hover:bg-muted ${settings?.scenarioNotes?.[scenario.name]?.notes ? 'text-primary' : 'text-muted-foreground'}`}
                                onClick={() => openNotes(scenario.name)}
                              >
                                <NotebookPen size={compactMode ? 14 : 16} />
                              </button>
                            </div>
                          )}

                          {showRecCol && (
                            <div className="flex items-center justify-center text-[12px]">
                              <RecommendationIndicator score={recommendation} compact={compactMode} isTopPick={isTopPick} isCompleted={isCompleted} />
                            </div>
                          )}

                          {showPlayCol && (
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                className={`${compactMode ? 'p-0.5' : 'p-1'} rounded-lg border border-transparent text-foreground transition-colors hover:border-border hover:bg-muted`}
                                onClick={() => launchScenario(scenario.name, 'challenge').catch(() => { })}
                              >
                                <Play size={compactMode ? 14 : 16} />
                              </button>
                            </div>
                          )}

                          {showHistoryCol && (
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                className={`${compactMode ? 'p-0.5' : 'p-1'} rounded-lg border border-transparent text-foreground transition-colors hover:border-border hover:bg-muted`}
                                onClick={() => openHistory(scenario.name)}
                              >
                                <ChartLine size={compactMode ? 14 : 16} />
                              </button>
                            </div>
                          )}

                          <div />
                          <div className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} flex items-center text-foreground`}>
                            {formatNumber(scenario.score, 0)}
                          </div>
                        </div>
                      </div>

                      <div className="ml-2 flex-1">
                        <div className="grid gap-1" style={{ gridTemplateColumns: rightLayout.templateColumns, minWidth: rightLayout.minWidth, width: '100%' }}>
                          {visibleRankIndices.map(rankIndex => {
                            const rank = rankDefs[rankIndex]
                            const fill = cellFill(rankIndex, scenario.score, scenario.thresholds)
                            const fillColor = computeFillColor(scenario.scenarioRank, rankDefs)
                            const value = scenario.thresholds?.[rankIndex + 1]

                            return (
                              <div key={`${scenario.name}-${rank.name}-${rankIndex}`} className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} relative flex items-center justify-center overflow-hidden rounded-xl bg-background/70 px-3 text-center`}>
                                <div className="absolute inset-y-0 left-0 rounded-l" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
                                <span className={`relative w-full ${compactMode ? 'py-0.5' : 'py-1'} flex items-center justify-center text-foreground`}>
                                  {value != null ? formatNumber(value, 0) : MISSING_STR}
                                </span>
                              </div>
                            )
                          })}

                          {hasEnergy && (
                            <div className="flex items-center justify-center text-[12px] text-foreground">
                              {scenario.energy != null ? formatNumber(Number(scenario.energy), 0) : (groupEnergy != null ? formatNumber(Number(groupEnergy), 0) : MISSING_STR)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {showCurrentSeparator && index === 0 && <div className="mx-5 mb-3 border-b-2 border-primary/20" />}
                  </Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Tracker Settings" width={700} height="auto">
        <div className="space-y-6 px-6 pb-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Feature Columns</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showNotesCol} onCheckedChange={(value: boolean | 'indeterminate') => setShowNotesCol(Boolean(value))} /> Notes</label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showRecCol} onCheckedChange={(value: boolean | 'indeterminate') => setShowRecCol(Boolean(value))} /> Recommendations</label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showPlayCol} onCheckedChange={(value: boolean | 'indeterminate') => setShowPlayCol(Boolean(value))} /> Play</label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showHistoryCol} onCheckedChange={(value: boolean | 'indeterminate') => setShowHistoryCol(Boolean(value))} /> History</label>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Rank Visibility</h4>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={autoHideCleared} onCheckedChange={(value: boolean | 'indeterminate') => setAutoHideCleared(Boolean(value))} /> Auto-hide earlier cleared ranks
              </label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Keep visible:</span>
                <Select value={String(visibleRankCount)} onValueChange={(value: string) => setVisibleRankCount(Math.max(1, Number(value) || 1))}>
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.max(9, rankDefs.length) }, (_, index) => index + 1).map(count => (
                      <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={resetManual}>Reset Manual</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {rankDefs.map((rank, index) => {
                const visible = !(manuallyHidden.has(index) || autoHidden.has(index))
                return (
                  <button
                    type="button"
                    key={`${rank.name}-${index}`}
                    disabled={autoHidden.has(index)}
                    onClick={() => toggleManualRank(index)}
                    className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors ${visible ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground'} ${autoHidden.has(index) ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted'}`}
                    style={rank.color ? { color: visible ? rank.color : undefined, borderColor: visible ? rank.color : undefined } : undefined}
                  >
                    {rank.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ScenarioNotesModal isOpen={notesState.open} onClose={() => setNotesState((previous: any) => ({ ...previous, open: false }))} scenarioName={notesState.scenario} initialNotes={notesState.notes} initialSensitivity={notesState.sensitivity} onSave={saveNotes} />
      <ScenarioHistoryModal isOpen={historyState.open} onClose={() => setHistoryState((previous: any) => ({ ...previous, open: false }))} scenarioName={historyState.scenario} />
    </section>
  )
}

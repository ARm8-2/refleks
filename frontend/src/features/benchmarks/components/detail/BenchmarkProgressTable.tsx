import { ChartLine, NotebookPen, Play, Settings2 } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Modal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/components'
import { usePersistedState, useStore } from '../../../../shared/hooks'
import { getSettings, launchScenario, saveScenarioNote } from '../../../../shared/lib'
import type { Benchmark, BenchmarkProgress, Settings } from '../../../../shared/types'
import { useBenchmarkVisibility } from '../../hooks/useBenchmarkVisibility'
import { useDragScroll } from '../../hooks/useDragScroll'
import { useResizableScenarioColumn } from '../../hooks/useResizableScenarioColumn'
import {
  ENERGY_COL_WIDTH,
  MISSING_STR,
  NOTES_COL_WIDTH,
  PADDING_COL_WIDTH,
  PLAY_COL_WIDTH,
  RANK_MIN_WIDTH,
  RECOMMEND_COL_WIDTH,
  SCORE_COL_WIDTH,
} from '../../lib/detailConstants'
import { cellFill, computeFillColor, formatNumber, getScenarioName } from '../../lib/detailFormatting'
import { computeRecommendationScores, selectTopPicks, type ScenarioBenchmarkData } from '../../lib/detailRecommendations'
import { RecommendationIndicator } from './RecommendationIndicator'
import { ScenarioHistoryModal } from './ScenarioHistoryModal'
import { ScenarioNotesModal } from './ScenarioNotesModal'

type Props = {
  benchmark: Benchmark
  difficultyName: string
  progress: BenchmarkProgress
}

type NotesState = {
  open: boolean
  scenario: string
  notes: string
  sensitivity: string
}

type HistoryState = {
  open: boolean
  scenario: string
}

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

export function BenchmarkProgressTable({ benchmark, difficultyName, progress }: Props) {
  const sessions = useStore(state => state.sessions)
  const containerRef = useRef<HTMLDivElement>(null)

  const storageBase = `refleks.benchmarks.detail.${benchmark.benchmarkName}.progress`

  const [compactMode, setCompactMode] = usePersistedState<boolean>(`${storageBase}.compact`, false)
  const [showNotesCol, setShowNotesCol] = usePersistedState<boolean>(`${storageBase}.showNotes`, true)
  const [showRecCol, setShowRecCol] = usePersistedState<boolean>(`${storageBase}.showRec`, true)
  const [showPlayCol, setShowPlayCol] = usePersistedState<boolean>(`${storageBase}.showPlay`, true)
  const [showHistoryCol, setShowHistoryCol] = usePersistedState<boolean>(`${storageBase}.showHistory`, true)
  const [showSettings, setShowSettings] = useState(false)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [notesState, setNotesState] = useState<NotesState>({ open: false, scenario: '', notes: '', sensitivity: '' })
  const [historyState, setHistoryState] = useState<HistoryState>({ open: false, scenario: '' })

  useDragScroll(containerRef, {
    axis: 'x',
    skipSelector: 'button, a, input, textarea, select, [role="button"]',
  })

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(null))
  }, [])

  const openNotes = (scenario: string) => {
    const note = settings?.scenarioNotes?.[scenario]
    setNotesState({
      open: true,
      scenario,
      notes: note?.notes || '',
      sensitivity: note?.sens || '',
    })
  }

  const saveNotes = async (notes: string, sensitivity: string) => {
    await saveScenarioNote(notesState.scenario, notes, sensitivity)
    setSettings(previous => ({
      ...(previous || {}),
      scenarioNotes: {
        ...(previous?.scenarioNotes || {}),
        [notesState.scenario]: { notes, sens: sensitivity },
      },
    }) as Settings)
  }

  const openHistory = (scenario: string) => {
    setHistoryState({ open: true, scenario })
  }

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

  const leftColumns = useMemo(() => {
    return [
      `${Math.round(scenarioWidth)}px`,
      `${PADDING_COL_WIDTH}px`,
      showNotesCol ? `${NOTES_COL_WIDTH}px` : null,
      showRecCol ? `${RECOMMEND_COL_WIDTH}px` : null,
      showPlayCol ? `${PLAY_COL_WIDTH}px` : null,
      showHistoryCol ? `${PLAY_COL_WIDTH}px` : null,
      `${PADDING_COL_WIDTH}px`,
      `${SCORE_COL_WIDTH}px`,
    ].filter(Boolean).join(' ')
  }, [scenarioWidth, showNotesCol, showRecCol, showPlayCol, showHistoryCol])

  const rightColumns = useMemo(() => {
    const columns: string[] = []

    if (visibleRankIndices.length > 0) {
      columns.push(visibleRankIndices.map(() => `${RANK_MIN_WIDTH}px`).join(' '))
    }

    if (hasEnergy) columns.push(`${ENERGY_COL_WIDTH}px`)

    if (!columns.length) return `${RANK_MIN_WIDTH}px`
    return columns.join(' ')
  }, [visibleRankIndices, hasEnergy])

  const wantedNames = useMemo(() => {
    const names = new Set<string>()
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          names.add(scenario.name)
        }
      }
    }
    return Array.from(names)
  }, [categories])

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

  const topPicks = useMemo(
    () => selectTopPicks(recommendationScore, scenarioCategoryMap, Math.max(3, categories.length || 3)),
    [recommendationScore, scenarioCategoryMap, categories.length],
  )

  const overallRankName = rankDefs[(progress.overallRank ?? 0) - 1]?.name || MISSING_STR

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Progress Tracker</h3>
          <p className="text-xs text-muted-foreground">
            {benchmark.abbreviation} {benchmark.benchmarkName} · {difficultyName} · Overall {overallRankName} · {formatNumber(progress.benchmarkProgress)}%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip label="Compact" enabled={compactMode} onToggle={() => setCompactMode(value => !value)} />
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="View settings">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing"
      >
        <div className="w-max min-w-full space-y-3 pb-4">
          <div className="sticky top-0 z-[30] rounded-xl bg-card py-2.5 pr-5">
            <div className="flex items-center">
              <div className="sticky left-0 z-20 flex w-[52px] shrink-0 bg-card pl-5" />
              <div className="sticky left-[52px] z-20 flex w-6 shrink-0 bg-card" />

              <div className="sticky left-[76px] z-20 shrink-0 bg-card pl-2 pr-2 shadow-[12px_0_12px_-6px_rgba(0,0,0,0.1)]">
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

              <div className="ml-2">
                <div className="grid gap-1" style={{ gridTemplateColumns: rightColumns }}>
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

          {categories.map(category => {
            const categoryColor = category.color || 'hsl(var(--foreground))'
            return (
              <div key={category.name} className={`min-w-max rounded-xl bg-card pr-5 ${compactMode ? 'py-3' : 'py-4'}`}>
                <div className="flex">
                  <div className="sticky left-0 z-20 flex w-[52px] shrink-0 items-center justify-center bg-card pl-5 py-2">
                    <span
                      className={`font-semibold tracking-wide ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}
                      style={{
                        color: categoryColor,
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                      }}
                    >
                      {category.name}
                    </span>
                  </div>

                  <div className={`flex-1 ${compactMode ? 'space-y-1.5' : 'space-y-3'}`}>
                    {category.groups.map((group, groupIndex) => {
                      const groupColor = group.color || 'hsl(var(--foreground))'

                      return (
                        <div key={`${category.name}-${groupIndex}`} className="flex">
                          <div className="sticky left-[52px] z-20 flex w-6 shrink-0 items-center justify-center bg-card pr-2">
                            {group.name ? (
                              <span
                                className={`font-semibold tracking-wide ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}
                                style={{
                                  color: groupColor,
                                  writingMode: 'vertical-rl',
                                  transform: 'rotate(180deg)',
                                }}
                              >
                                {group.name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                {MISSING_STR}
                              </span>
                            )}
                          </div>

                          <div className="sticky left-[76px] z-20 shrink-0 bg-card pl-2 pr-2 shadow-[12px_0_12px_-6px_rgba(0,0,0,0.1)]">
                            <div className="grid gap-1" style={{ gridTemplateColumns: leftColumns }}>
                              {group.scenarios.map(scenario => {
                                const recommendation = recommendationScore.get(scenario.name) ?? 0
                                const isTopPick = topPicks.has(scenario.name)
                                const isCompleted = scenario.scenarioRank >= (scenario.thresholds.length - 1)
                                const rankColor = computeFillColor(scenario.scenarioRank, rankDefs)

                                return (
                                  <Fragment key={`${scenario.name}-left`}>
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
                                          title="Notes & Sensitivity"
                                          onClick={() => openNotes(scenario.name)}
                                        >
                                          <NotebookPen size={compactMode ? 14 : 16} />
                                        </button>
                                      </div>
                                    )}

                                    {showRecCol && (
                                      <div className="flex items-center justify-center text-[12px]" title={`Recommendation score: ${recommendation}`}>
                                        <RecommendationIndicator
                                          score={recommendation}
                                          compact={compactMode}
                                          isTopPick={isTopPick}
                                          isCompleted={isCompleted}
                                        />
                                      </div>
                                    )}

                                    {showPlayCol && (
                                      <div className="flex items-center justify-center">
                                        <button
                                          type="button"
                                          className={`${compactMode ? 'p-0.5' : 'p-1'} rounded-lg border border-transparent text-foreground transition-colors hover:border-border hover:bg-muted`}
                                          title="Play in Kovaak's"
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
                                          title="Last 10 Scores"
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
                                  </Fragment>
                                )
                              })}
                            </div>
                          </div>

                          <div className="ml-2 flex-1">
                            <div className="grid gap-1" style={{ gridTemplateColumns: rightColumns }}>
                              {group.scenarios.map((scenario, scenarioIndex) => {
                                if (!visibleRankIndices.length && !hasEnergy) {
                                  return (
                                    <div key={`${scenario.name}-fallback`} className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} flex items-center justify-center rounded-xl bg-background/70 px-3 py-1 text-foreground`}>
                                      {MISSING_STR}
                                    </div>
                                  )
                                }

                                return (
                                  <Fragment key={`${scenario.name}-right`}>
                                    {visibleRankIndices.map(rankIndex => {
                                      const rank = rankDefs[rankIndex]
                                      const fill = cellFill(rankIndex, scenario.score, scenario.thresholds)
                                      const fillColor = computeFillColor(scenario.scenarioRank, rankDefs)
                                      const value = scenario.thresholds?.[rankIndex + 1]

                                      return (
                                        <div key={`${scenario.name}-${rank.name}-${rankIndex}`} className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} relative flex items-center justify-center overflow-hidden rounded-xl bg-background/70 px-3 text-center`}>
                                          <div
                                            className="absolute inset-y-0 left-0 rounded-l"
                                            style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }}
                                          />
                                          <span className={`relative w-full ${compactMode ? 'py-0.5' : 'py-1'} flex items-center justify-center text-foreground`}>
                                            {value != null ? formatNumber(value, 0) : MISSING_STR}
                                          </span>
                                        </div>
                                      )
                                    })}

                                    {hasEnergy && (
                                      scenario.energy == null && group.energy != null
                                        ? (
                                          scenarioIndex === 0 ? (
                                            <div className="flex items-center justify-center text-[12px] text-foreground" style={{ gridRow: `span ${group.scenarios.length}` }}>
                                              {formatNumber(Number(group.energy), 0)}
                                            </div>
                                          ) : null
                                        ) : (
                                          <div className="flex items-center justify-center text-[12px] text-foreground">
                                            {scenario.energy != null ? formatNumber(Number(scenario.energy), 0) : MISSING_STR}
                                          </div>
                                        )
                                    )}
                                  </Fragment>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Tracker Settings" width={700} height="auto">
        <div className="space-y-6 px-6 pb-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Feature Columns</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showNotesCol} onCheckedChange={value => setShowNotesCol(Boolean(value))} /> Notes</label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showRecCol} onCheckedChange={value => setShowRecCol(Boolean(value))} /> Recommendations</label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showPlayCol} onCheckedChange={value => setShowPlayCol(Boolean(value))} /> Play</label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground"><Checkbox checked={showHistoryCol} onCheckedChange={value => setShowHistoryCol(Boolean(value))} /> History</label>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Rank Visibility</h4>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={autoHideCleared} onCheckedChange={value => setAutoHideCleared(Boolean(value))} />
                Auto-hide earlier cleared ranks
              </label>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Keep visible:</span>
                <Select value={String(visibleRankCount)} onValueChange={value => setVisibleRankCount(Math.max(1, Number(value) || 1))}>
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
                const hiddenManually = manuallyHidden.has(index)
                const hiddenAutomatically = autoHidden.has(index)
                const visible = !(hiddenManually || hiddenAutomatically)
                return (
                  <button
                    type="button"
                    key={`${rank.name}-${index}`}
                    disabled={hiddenAutomatically}
                    onClick={() => toggleManualRank(index)}
                    className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors ${visible
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border bg-card text-muted-foreground'} ${hiddenAutomatically ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted'}`}
                    style={rank.color ? { color: visible ? rank.color : undefined, borderColor: visible ? rank.color : undefined } : undefined}
                    title={hiddenAutomatically ? 'Hidden automatically (all scenarios are past this rank)' : undefined}
                  >
                    {rank.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ScenarioNotesModal
        isOpen={notesState.open}
        onClose={() => setNotesState(previous => ({ ...previous, open: false }))}
        scenarioName={notesState.scenario}
        initialNotes={notesState.notes}
        initialSensitivity={notesState.sensitivity}
        onSave={saveNotes}
      />

      <ScenarioHistoryModal
        isOpen={historyState.open}
        onClose={() => setHistoryState(previous => ({ ...previous, open: false }))}
        scenarioName={historyState.scenario}
      />
    </section>
  )
}

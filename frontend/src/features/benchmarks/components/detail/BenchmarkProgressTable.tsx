
import { REFLEKS_SYMBOL } from '@/assets'
import { Button, Checkbox, Modal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TogglePill } from '@/shared/components'
import { usePersistedState, useStore } from '@/shared/hooks'
import {
  benchmarkDetailProgressStorageBase,
  benchmarkDetailProgressStorageKey,
  getSettings,
  launchScenario,
  saveScenarioNote,
} from '@/shared/lib'
import type { Benchmark, BenchmarkProgress, Settings } from '@/shared/types'
import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useBenchmarkVisibility } from '../../hooks/useBenchmarkVisibility'
import { adjustColorForTheme, getScenarioName } from '../../lib/detailFormatting'
import { computeRecommendationScores, selectTopPicks, type ScenarioBenchmarkData } from '../../lib/detailRecommendations'
import { ScenarioHistoryModal } from './ScenarioHistoryModal'
import { ScenarioNotesModal } from './ScenarioNotesModal'
import {
  buildInfoColumns,
  getRowClasses,
  RANK_MIN_COLUMN_WIDTH,
  ScenarioInfoRow,
  ScenarioRankCells
} from './ScenarioRow'

type Props = {
  benchmark: Benchmark
  difficultyName: string
  progress: BenchmarkProgress
  shareMode?: boolean
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
  thresholds: number[]
}

const CATEGORY_COLUMN_WIDTH = 52
const GROUP_COLUMN_WIDTH = 24
const LEFT_PANEL_PADDING = 16

export function BenchmarkProgressTable({ benchmark, difficultyName, progress, shareMode = false }: Props) {
  const sessions = useStore(state => state.sessions)

  const storageBase = benchmarkDetailProgressStorageBase(benchmark.benchmarkName)

  const [compactMode, setCompactMode] = usePersistedState<boolean>(benchmarkDetailProgressStorageKey(benchmark.benchmarkName, 'compact'), false)
  const [showNotesCol, setShowNotesCol] = usePersistedState<boolean>(benchmarkDetailProgressStorageKey(benchmark.benchmarkName, 'showNotes'), true)
  const [showRecCol, setShowRecCol] = usePersistedState<boolean>(benchmarkDetailProgressStorageKey(benchmark.benchmarkName, 'showRec'), true)
  const [showPlayCol, setShowPlayCol] = usePersistedState<boolean>(benchmarkDetailProgressStorageKey(benchmark.benchmarkName, 'showPlay'), true)
  const [showHistoryCol, setShowHistoryCol] = usePersistedState<boolean>(benchmarkDetailProgressStorageKey(benchmark.benchmarkName, 'showHistory'), true)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [notesState, setNotesState] = useState<NotesState>({ open: false, scenario: '', notes: '', sensitivity: '' })
  const [historyState, setHistoryState] = useState<HistoryState>({ open: false, scenario: '', thresholds: [] })

  useEffect(() => {
    if (shareMode) return
    getSettings().then(setSettings).catch(() => setSettings(null))
  }, [shareMode])

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

  const openHistory = (scenario: string, thresholds: number[]) => {
    setHistoryState({ open: true, scenario, thresholds })
  }

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

  const effectiveShowNotesCol = !shareMode && showNotesCol
  const effectiveShowRecCol = !shareMode && showRecCol
  const effectiveShowPlayCol = !shareMode && showPlayCol
  const effectiveShowHistoryCol = !shareMode && showHistoryCol

  const infoColumns = useMemo(
    () => buildInfoColumns(effectiveShowNotesCol, effectiveShowRecCol, effectiveShowPlayCol, effectiveShowHistoryCol),
    [effectiveShowNotesCol, effectiveShowRecCol, effectiveShowPlayCol, effectiveShowHistoryCol],
  )

  const infoGridTemplate = useMemo(
    () => infoColumns.map(column => `${column.width}px`).join(' '),
    [infoColumns],
  )

  const infoGridWidth = useMemo(
    () => infoColumns.reduce((total, column) => total + column.width, 0),
    [infoColumns],
  )

  const rightPanelOffset = CATEGORY_COLUMN_WIDTH + GROUP_COLUMN_WIDTH + LEFT_PANEL_PADDING + infoGridWidth
  const hasVisibleRanks = visibleRankIndices.length > 0
  const rightGridTemplate = hasVisibleRanks
    ? `repeat(${visibleRankIndices.length}, minmax(${RANK_MIN_COLUMN_WIDTH}px, 1fr))`
    : `minmax(${RANK_MIN_COLUMN_WIDTH}px, 1fr)`
  const rightGridMinWidth = Math.max(1, visibleRankIndices.length) * RANK_MIN_COLUMN_WIDTH
  const overallRankName = rankDefs[(progress.overallRank ?? 0) - 1]?.name || '-'
  const overallRankColor = rankDefs[(progress.overallRank ?? 0) - 1]?.color ?? null
  const cls = getRowClasses(compactMode)
  const categoryPaddingClass = compactMode ? 'py-3' : 'py-4'
  const categorySpacingClass = compactMode ? 'space-y-1.5' : 'space-y-2'
  const rowSpacingClass = compactMode ? 'space-y-0.5' : 'space-y-1'
  const labelTextClass = compactMode ? 'text-[10px]' : 'text-[11px]'
  const rankVisibilityOptions = Array.from({ length: Math.max(1, rankDefs.length) }, (_, index) => index + 1)
  const labelBackgroundColor = 'var(--surface)'

  const getRecommendation = (scenarioName: string) => recommendationScore.get(scenarioName) ?? 0
  const isTopPick = (scenarioName: string) => topPicks.has(scenarioName)

  return (
    <section className="relative z-0 space-y-3">
      {shareMode && (
        <div className="flex items-center gap-2 px-1">
          <img src={REFLEKS_SYMBOL} alt="RefleK's" className="h-12 w-12" />
          <div>
            <p className="text-lg font-semibold text-foreground">RefleK's</p>
            <p className="text-sm text-surface-muted-foreground">Benchmark Progress Snapshot</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Progress Tracker</h3>
          <p className="text-xs text-surface-muted-foreground">
            {benchmark.benchmarkName} · {difficultyName} ·{' '}
            <span style={overallRankColor ? { color: overallRankColor } : undefined}>{overallRankName}</span>
          </p>
        </div>

        {!shareMode && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={compactMode ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setCompactMode(value => !value)}
              aria-pressed={compactMode}
              title={compactMode ? 'Disable compact mode' : 'Enable compact mode'}
            >
              Compact
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="View tracker settings">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative z-0">
        <div className="relative z-0 w-full space-y-3 pb-4">
          <div className="relative mb-3 w-full rounded-xl bg-surface py-2 shadow-sm">
            <div className="flex items-center">
              <div className="flex h-[28px] w-[52px] shrink-0 bg-transparent pl-5" />
              <div className="flex h-[28px] w-6 shrink-0 bg-transparent" />
              <div className="shrink-0 bg-transparent pl-2 pr-2">
                <div className="grid h-[28px] items-center" style={{ gridTemplateColumns: infoGridTemplate }}>
                  <div className="select-none overflow-hidden text-ellipsis whitespace-nowrap text-[11px] uppercase tracking-wide text-surface-muted-foreground">
                    Scenario
                  </div>
                  <div />
                  {effectiveShowNotesCol && <div />}
                  {effectiveShowRecCol && <div className="text-center text-[11px] uppercase tracking-wide text-surface-muted-foreground">Rec</div>}
                  {effectiveShowPlayCol && <div />}
                  {effectiveShowHistoryCol && <div />}
                  <div />
                  <div className="text-right text-[11px] uppercase tracking-wide text-surface-muted-foreground">Score</div>
                </div>
              </div>
            </div>
          </div>

          {categories.map(category => (
            <div key={category.name} className={`relative w-full overflow-hidden rounded-xl bg-surface shadow-sm ${categoryPaddingClass}`}>
              <div className="flex">
                <div className="flex w-[52px] shrink-0 items-center justify-center bg-transparent pl-5">
                  <span
                    className={`font-semibold tracking-wide text-foreground ${labelTextClass}`}
                    style={{
                      color: adjustColorForTheme(category.color, labelBackgroundColor, 0.96),
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                    }}
                  >
                    {category.name}
                  </span>
                </div>

                <div className={`flex-1 ${categorySpacingClass}`}>
                  {category.groups.map((group, groupIndex) => (
                    <div key={`${category.name}-${groupIndex}`} className="relative flex">
                      <div className="flex w-6 shrink-0 items-center justify-center bg-transparent pr-2">
                        {group.name ? (
                          <span
                            className={`font-semibold tracking-wide text-foreground ${labelTextClass}`}
                            style={{
                              color: adjustColorForTheme(group.color || category.color, labelBackgroundColor, 0.96),
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                            }}
                          >
                            {group.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-surface-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            -
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 bg-transparent pl-2 pr-2">
                        <div className={rowSpacingClass}>
                          {group.scenarios.map(scenario => {
                            const recommendation = getRecommendation(scenario.name)
                            const completedThreshold = Math.max(1, (scenario.thresholds?.length ?? 0) - 1)
                            const completed = scenario.scenarioRank >= completedThreshold
                            const hasSavedNote = Boolean(settings?.scenarioNotes?.[scenario.name]?.notes)

                            return (
                              <ScenarioInfoRow
                                key={scenario.name}
                                scenarioName={scenario.name}
                                score={scenario.score || 0}
                                gridTemplate={infoGridTemplate}
                                cls={cls}
                                showNotesCol={effectiveShowNotesCol}
                                showRecCol={effectiveShowRecCol}
                                showPlayCol={effectiveShowPlayCol}
                                showHistoryCol={effectiveShowHistoryCol}
                                hasSavedNote={hasSavedNote}
                                recommendation={recommendation}
                                isTopPick={isTopPick(scenario.name)}
                                completed={completed}
                                onNotes={() => openNotes(scenario.name)}
                                onHistory={() => openHistory(scenario.name, scenario.thresholds || [])}
                                onPlay={() => launchScenario(scenario.name, 'challenge').catch(() => { })}
                              />
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="pointer-events-auto absolute bottom-0 right-0 top-0 z-10 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ left: rightPanelOffset }}
        >
          <div className="min-h-full min-w-full w-max space-y-3 pb-4 pr-2">
            <div className="relative mb-3 min-w-full py-2 pr-1">
              <div className="flex h-[28px] items-center">
                <div className="flex-1">
                  <div className="grid h-[28px] items-center gap-1" style={{ gridTemplateColumns: rightGridTemplate, minWidth: rightGridMinWidth, width: '100%' }}>
                    {hasVisibleRanks ? visibleRanks.map((rank, index) => (
                      <div
                        key={`${rank.name}-${visibleRankIndices[index]}`}
                        className="text-center text-[11px] uppercase tracking-wide text-surface-muted-foreground"
                        style={rank.color ? { color: rank.color } : undefined}
                      >
                        {rank.name}
                      </div>
                    )) : (
                      <div className="text-center text-[11px] uppercase tracking-wide text-surface-muted-foreground">Details</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {categories.map(category => (
              <div key={`${category.name}-right`} className={`min-w-full pr-1 ${categoryPaddingClass}`}>
                <div className="flex">
                  <div className={`w-full flex-1 ${categorySpacingClass}`}>
                    {category.groups.map((group, groupIndex) => (
                      <div key={`${category.name}-${groupIndex}-right`} className="relative flex">
                        <div className="flex-1">
                          <div className={rowSpacingClass}>
                            {group.scenarios.map(scenario => (
                              <ScenarioRankCells
                                key={`${scenario.name}-ranks`}
                                scenarioName={scenario.name}
                                score={scenario.score || 0}
                                scenarioRank={scenario.scenarioRank}
                                thresholds={scenario.thresholds || []}
                                rankDefs={rankDefs}
                                visibleRankIndices={visibleRankIndices}
                                hasVisibleRanks={hasVisibleRanks}
                                rightGridTemplate={rightGridTemplate}
                                rightGridMinWidth={rightGridMinWidth}
                                cls={cls}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {shareMode && (
        <div className="px-1 text-xs text-surface-muted-foreground">refleks-app.com</div>
      )}

      {!shareMode && (
        <>
          <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Tracker Settings" width={700} height="auto">
            <div className="space-y-6 px-6 pb-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Feature Columns</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={showNotesCol} onCheckedChange={value => setShowNotesCol(Boolean(value))} />
                    Notes
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={showRecCol} onCheckedChange={value => setShowRecCol(Boolean(value))} />
                    Recommendations
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={showPlayCol} onCheckedChange={value => setShowPlayCol(Boolean(value))} />
                    Play
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={showHistoryCol} onCheckedChange={value => setShowHistoryCol(Boolean(value))} />
                    History
                  </label>
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
                    <span className="text-surface-muted-foreground">Keep visible:</span>
                    <Select value={String(visibleRankCount)} onValueChange={value => setVisibleRankCount(Math.max(1, Number(value) || 1))}>
                      <SelectTrigger className="h-8 w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rankVisibilityOptions.map(count => (
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
                      <TogglePill
                        key={`${rank.name}-${index}`}
                        disabled={hiddenAutomatically}
                        onClick={() => toggleManualRank(index)}
                        active={visible}
                        className="h-auto px-2.5 py-1 text-xs"
                        style={rank.color && visible ? { color: rank.color } : undefined}
                        title={hiddenAutomatically ? 'Hidden automatically because every scenario is already past this rank' : undefined}
                      >
                        {rank.name}
                      </TogglePill>
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
            thresholds={historyState.thresholds}
            rankDefs={rankDefs}
          />
        </>
      )}
    </section>
  )
}

export default BenchmarkProgressTable

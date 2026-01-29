import { ChartLine, Info, NotebookPen, Play, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBenchmarkVisibility } from '../../hooks/useBenchmarkVisibility'
import { useDragScroll } from '../../hooks/useDragScroll'
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll'
import { usePageState } from '../../hooks/usePageState'
import { useResizableScenarioColumn } from '../../hooks/useResizableScenarioColumn'
import { useStore } from '../../hooks/useStore'
import { ENERGY_COL_WIDTH, NOTES_COL_WIDTH, PADDING_COL_WIDTH, PLAY_COL_WIDTH, RANK_MIN_WIDTH, RECOMMEND_COL_WIDTH, SCORE_COL_WIDTH } from '../../lib/benchmarks/layout'
import { computeRecommendationScores, selectTopPicks, type ScenarioBenchmarkData } from '../../lib/benchmarks/recommendations'
import { MISSING_STR } from '../../lib/constants'
import { getSettings, launchScenario, saveScenarioNote } from '../../lib/internal'
import { formatNumber, getScenarioName } from '../../lib/utils'
import type { BenchmarkProgress as ProgressModel } from '../../types/ipc'
import { ContextMenu } from '../shared/ContextMenu'
import { Modal } from '../shared/Modal'
import { Toggle } from '../shared/Toggle'
import { BenchmarkControls } from './BenchmarkControls'
import { BenchmarkInfoModal } from './BenchmarkInfoModal'
import { BenchmarkScenarioRow } from './BenchmarkScenarioRow'
import { ScenarioHistoryModal } from './ScenarioHistoryModal'
import { ScenarioNotesModal } from './ScenarioNotesModal'

type BenchmarkProgressProps = {
  progress: ProgressModel
}

export function BenchmarkProgress({ progress }: BenchmarkProgressProps) {
  const rankDefs = progress?.ranks || []

  const categories = progress?.categories || []

  const sessions = useStore(s => s.sessions)

  // Ref to horizontal scroll container
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Resizable scenario column state (effects & dynamic columns defined after rank visibility calc)
  const { scenarioWidth, onHandleMouseDown } = useResizableScenarioColumn({ initialWidth: 220, min: 140, max: 600 })

  const overallRankName = rankDefs[(progress?.overallRank ?? 0) - 1]?.name || MISSING_STR
  const [hScrollEnabled, setHScrollEnabled] = usePageState<boolean>('bench:progress:horizontalScroll', false)
  const [compactMode, setCompactMode] = usePageState<boolean>('bench:progress:compactMode', false)
  const [showLegend, setShowLegend] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Column visibility state
  const [showNotesCol, setShowNotesCol] = usePageState<boolean>('bench:progress:showNotesCol', true)
  const [showRecCol, setShowRecCol] = usePageState<boolean>('bench:progress:showRecCol', true)
  const [showPlayCol, setShowPlayCol] = usePageState<boolean>('bench:progress:showPlayCol', true)
  const [showHistoryCol, setShowHistoryCol] = usePageState<boolean>('bench:progress:showHistoryCol', true)

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, scenario: string, thresholds: number[] } | null>(null)

  // Notes modal state
  const [settings, setSettings] = useState<any>(null)
  useEffect(() => {
    getSettings().then(setSettings).catch(() => { })
  }, [])

  const [modalState, setModalState] = useState<{ open: boolean, scenario: string, notes: string, sens: string }>({ open: false, scenario: '', notes: '', sens: '' })

  const openNotes = (scenario: string) => {
    const note = settings?.scenarioNotes?.[scenario]
    setModalState({
      open: true,
      scenario,
      notes: note?.notes || '',
      sens: note?.sens || ''
    })
  }

  const saveNotes = async (notes: string, sens: string) => {
    await saveScenarioNote(modalState.scenario, notes, sens)
    setSettings((prev: any) => ({
      ...prev,
      scenarioNotes: {
        ...prev?.scenarioNotes,
        [modalState.scenario]: { notes, sens }
      }
    }))
  }

  const [historyModalState, setHistoryModalState] = useState<{ open: boolean, scenario: string, thresholds?: number[] }>({ open: false, scenario: '' })
  const openHistory = (scenario: string, thresholds: number[]) => {
    setHistoryModalState({ open: true, scenario, thresholds })
  }

  // Build name sets and historical metrics used for recommendations
  const wantedNames = useMemo(() => {
    const set = new Set<string>()
    for (const { groups } of categories) {
      for (const g of groups) {
        for (const s of g.scenarios) set.add(s.name)
      }
    }
    return Array.from(set)
  }, [categories])

  const lastSession = useMemo(() => sessions[0] ?? null, [sessions])
  const lastSessionCount = useMemo(() => {
    const m = new Map<string, number>()
    if (lastSession) {
      for (const it of lastSession.items) {
        const n = getScenarioName(it)
        m.set(n, (m.get(n) || 0) + 1)
      }
    }
    return m
  }, [lastSession])

  // Build benchmark data map for recommendation engine
  const benchmarkData = useMemo(() => {
    const map = new Map<string, ScenarioBenchmarkData>()
    for (const { groups, name: catName } of categories) {
      for (const g of groups) {
        for (const s of g.scenarios) {
          map.set(s.name, {
            rank: Number(s.scenarioRank || 0),
            score: Number(s.score || 0),
            thresholds: s.thresholds || [],
            category: catName
          })
        }
      }
    }
    return map
  }, [categories])

  // Map scenario -> category name for diversity
  const scenarioCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!categories) return map
    for (const cat of categories) {
      for (const g of cat.groups) {
        for (const s of g.scenarios) {
          map.set(s.name, cat.name)
        }
      }
    }
    return map
  }, [categories])

  // Recommendation score per scenario name
  const recScore = useMemo(() => computeRecommendationScores({
    wantedNames,
    lastSessionCount,
    sessions,
    benchmarkData
  }), [wantedNames, lastSessionCount, sessions, benchmarkData])

  // Identify top picks (top 3 with score >= 2, diverse categories)
  const topPicks = useMemo(() => {
    const maxPicks = categories ? Math.max(3, categories.length) : 3
    return selectTopPicks(recScore, scenarioCategoryMap, maxPicks)
  }, [recScore, scenarioCategoryMap, categories])

  // Ranks visibility controls (refactored into hook)
  const {
    autoHideCleared, setAutoHideCleared,
    visibleRankCount, setVisibleRankCount,
    manuallyHidden, toggleManualRank, resetManual,
    autoHidden,
    visibleRankIndices,
    visibleRanks
  } = useBenchmarkVisibility(progress)

  const hasEnergy = useMemo(() => {
    if (!categories) return false
    for (const cat of categories) {
      for (const g of cat.groups) {
        if (g.energy != null) return true
        for (const s of g.scenarios) {
          if (s.energy != null) return true
        }
      }
    }
    return false
  }, [categories])

  // Dynamic grid columns (flex growth for ranks): Scenario | Pad | Notes | Recom | Play | History | Pad | Score | Rank1..N
  const dynamicColumns = useMemo(() => {
    const rankTracks = visibleRankIndices.map(() => `minmax(${RANK_MIN_WIDTH}px,1fr)`).join(' ')
    const parts = [
      `${Math.round(scenarioWidth)}px`,
      `${PADDING_COL_WIDTH}px`,
      showNotesCol ? `${NOTES_COL_WIDTH}px` : null,
      showRecCol ? `${RECOMMEND_COL_WIDTH}px` : null,
      showPlayCol ? `${PLAY_COL_WIDTH}px` : null,
      showHistoryCol ? `${PLAY_COL_WIDTH}px` : null,
      `${PADDING_COL_WIDTH}px`,
      `${SCORE_COL_WIDTH}px`,
      rankTracks,
      hasEnergy ? `${ENERGY_COL_WIDTH}px` : null
    ].filter(Boolean).join(' ')
    return parts
  }, [scenarioWidth, visibleRankIndices.length, hasEnergy, showNotesCol, showRecCol, showPlayCol, showHistoryCol])

  // Attach refined wheel scroll: only enable horizontal wheel mapping when
  // the cursor is over the rank columns. We compute the left-offset where ranks begin.
  useHorizontalWheelScroll(containerRef, { excludeLeftWidth: scenarioWidth + PADDING_COL_WIDTH + (showNotesCol ? NOTES_COL_WIDTH : 0) + (showRecCol ? RECOMMEND_COL_WIDTH : 0) + (showPlayCol ? PLAY_COL_WIDTH : 0) + (showHistoryCol ? PLAY_COL_WIDTH : 0) + PADDING_COL_WIDTH + SCORE_COL_WIDTH, enabled: hScrollEnabled })
  // Drag-> allow grabbing container to scroll horizontally (skip interactive elements / resize handles)
  // Always enable drag-to-scroll regardless of the wheel mapping toggle
  useDragScroll(containerRef, { axis: 'x', skipSelector: 'button, a, input, textarea, select, [role="button"]' })

  const handleContextMenu = (e: React.MouseEvent, scenario: string, thresholds: number[]) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, scenario, thresholds })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-primary">
        <div>
          Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{formatNumber(progress?.benchmarkProgress)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Toggle size="sm" label="Compact mode" checked={compactMode} onChange={setCompactMode} />
          <Toggle size="sm" label="Horizontal scroll" checked={hScrollEnabled} onChange={setHScrollEnabled} />
          <button
            className="p-1 rounded hover:bg-surface-3 text-primary"
            onClick={() => setShowSettings(true)}
            title="Rank column settings"
          >
            <Settings2 size={18} />
          </button>
          <button
            className="p-1 rounded hover:bg-surface-3 text-primary"
            onClick={() => setShowLegend(true)}
            title="Recommendation legend"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {categories && (
        <div className="overflow-x-auto" ref={containerRef}>
          <div className="min-w-max">
            {/* Single sticky header aligned with all categories */}
            <div className="sticky top-0">
              <div className="border border-primary rounded bg-surface-3 overflow-hidden">
                <div className="flex gap-2 px-2 py-2">
                  {/* Placeholders for category and subcategory label columns */}
                  <div className="w-8 flex-shrink-0" />
                  <div className="w-8 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="grid gap-1" style={{ gridTemplateColumns: dynamicColumns }}>
                      <div className="text-[11px] text-secondary uppercase tracking-wide relative select-none" style={{ width: scenarioWidth }}>
                        <span>Scenario</span>
                        {/* Drag handle */}
                        <div
                          onMouseDown={onHandleMouseDown}
                          className="absolute top-0 right-0 h-full w-2 cursor-col-resize group"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Resize scenario column"
                        >
                          <div className="h-full w-px bg-border-secondary group-hover:bg-accent" />
                        </div>
                      </div>
                      <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>
                      {showNotesCol && <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>}
                      {showRecCol && <div className="text-[11px] text-secondary uppercase tracking-wide text-center" title="Recommendation score"></div>}
                      {showPlayCol && <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>}
                      {showHistoryCol && <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>}
                      <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>
                      <div className="text-[11px] text-secondary uppercase tracking-wide">Score</div>
                      {visibleRanks.map(r => (
                        <div
                          key={r.name}
                          className={`text-[11px] uppercase tracking-wide text-center ${r.color ? '' : 'text-secondary'}`}
                          style={r.color ? { color: r.color } : undefined}
                        >
                          {r.name}
                        </div>
                      ))}
                      {hasEnergy && <div className="text-[11px] text-secondary uppercase tracking-wide text-center">Energy</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Category cards content */}
            {categories.map(({ name: catName, color: catColor, groups }) => {
              const ranks = rankDefs
              // Lighten the category color for better readability on dark backgrounds
              const displayCatColor = catColor ? `color-mix(in srgb, ${catColor}, white)` : 'var(--text-primary)'

              return (
                <div key={catName} className={`border border-primary rounded bg-surface-3 overflow-hidden ${compactMode ? 'mt-1' : 'mt-3'}`}>
                  <div className="flex">
                    {/* Category vertical label with fixed width for alignment */}
                    <div className="w-8 px-1 py-2 flex items-center justify-center">
                      <span
                        className={`font-bold tracking-wide ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}
                        style={{
                          color: displayCatColor,
                          // textShadow: `0 0 20px ${catColor || 'var(--text-primary)'}`,
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)'
                        }}
                      >
                        {catName}
                      </span>
                    </div>
                    <div className={`flex-1 p-2 ${compactMode ? 'space-y-1' : 'space-y-3'}`}>
                      {groups.map((g, gi) => {
                        const displaySubColor = g.color ? `color-mix(in srgb, ${g.color}, white)` : 'var(--text-primary)'
                        return (
                          <div key={gi} className="flex gap-2">
                            {/* Subcategory vertical label with fixed width for alignment */}
                            <div className="w-6 pr-2 flex items-center justify-center flex-shrink-0">
                              {g.name ? (
                                <span
                                  className={`font-bold tracking-wide ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}
                                  style={{
                                    color: displaySubColor,
                                    // textShadow: `0 0 15px ${g.color || 'var(--text-primary)'}`,
                                    writingMode: 'vertical-rl',
                                    transform: 'rotate(180deg)'
                                  }}
                                >
                                  {g.name}
                                </span>
                              ) : (
                                <span className={`text-secondary ${compactMode ? 'text-[9px]' : 'text-[10px]'}`} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{MISSING_STR}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-max content-center">
                              <div className="grid gap-1" style={{ gridTemplateColumns: dynamicColumns }}>
                                {g.scenarios.map((s, si) => (
                                  <BenchmarkScenarioRow
                                    key={s.name}
                                    s={s}
                                    g={g}
                                    si={si}
                                    compactMode={compactMode}
                                    showNotesCol={showNotesCol}
                                    showRecCol={showRecCol}
                                    showPlayCol={showPlayCol}
                                    showHistoryCol={showHistoryCol}
                                    settings={settings}
                                    recScore={recScore}
                                    topPicks={topPicks}
                                    ranks={ranks}
                                    visibleRankIndices={visibleRankIndices}
                                    hasEnergy={hasEnergy}
                                    handleContextMenu={handleContextMenu}
                                    openNotes={openNotes}
                                    openHistory={openHistory}
                                  />
                                ))}
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
      )}
      <BenchmarkInfoModal isOpen={showLegend} onClose={() => setShowLegend(false)} />

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="View Settings" width="600px" height="auto">
        <div className="p-4">
          <BenchmarkControls
            rankDefs={rankDefs}
            autoHideCleared={autoHideCleared}
            setAutoHideCleared={setAutoHideCleared}
            visibleRankCount={visibleRankCount}
            setVisibleRankCount={setVisibleRankCount}
            manuallyHidden={manuallyHidden}
            toggleManualRank={toggleManualRank}
            resetManual={resetManual}
            autoHidden={autoHidden}
            showNotesCol={showNotesCol}
            setShowNotesCol={setShowNotesCol}
            showRecCol={showRecCol}
            setShowRecCol={setShowRecCol}
            showPlayCol={showPlayCol}
            setShowPlayCol={setShowPlayCol}
            showHistoryCol={showHistoryCol}
            setShowHistoryCol={setShowHistoryCol}
          />
        </div>
      </Modal>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Play in Kovaak\'s',
              icon: <Play size={14} />,
              onClick: () => launchScenario(contextMenu.scenario, 'challenge').catch(() => { })
            },
            {
              label: 'Notes & Sensitivity',
              icon: <NotebookPen size={14} />,
              onClick: () => openNotes(contextMenu.scenario)
            },
            {
              label: 'View History',
              icon: <ChartLine size={14} />,
              onClick: () => openHistory(contextMenu.scenario, contextMenu.thresholds)
            }
          ]}
        />
      )}

      {modalState.open && (
        <ScenarioNotesModal
          isOpen={modalState.open}
          scenarioName={modalState.scenario}
          initialNotes={modalState.notes}
          initialSens={modalState.sens}
          onClose={() => setModalState(s => ({ ...s, open: false }))}
          onSave={saveNotes}
        />
      )}

      {historyModalState.open && (
        <ScenarioHistoryModal
          isOpen={historyModalState.open}
          scenarioName={historyModalState.scenario}
          onClose={() => setHistoryModalState(s => ({ ...s, open: false }))}
          ranks={progress.ranks}
          thresholds={historyModalState.thresholds}
        />
      )}
    </div>
  )
}

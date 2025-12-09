import { Info, NotebookPen, Play, Settings2 } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useBenchmarkVisibility } from '../../hooks/useBenchmarkVisibility'
import { useDragScroll } from '../../hooks/useDragScroll'
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll'
import { usePageState } from '../../hooks/usePageState'
import { useResizableScenarioColumn } from '../../hooks/useResizableScenarioColumn'
import { useStore } from '../../hooks/useStore'
import { cellFill, computeFillColor, computeRecommendationScores, ENERGY_COL_WIDTH, NOTES_COL_WIDTH, numberFmt, PADDING_COL_WIDTH, PLAY_COL_WIDTH, RANK_MIN_WIDTH, RECOMMEND_COL_WIDTH, SCORE_COL_WIDTH, selectTopPicks, type ScenarioBenchmarkData } from '../../lib/benchmarks'
import { getSettings, launchScenario, saveScenarioNote } from '../../lib/internal'
import { getScenarioName, MISSING_STR } from '../../lib/utils'
import type { BenchmarkProgress as ProgressModel } from '../../types/ipc'
import { Modal } from '../shared/Modal'
import { Toggle } from '../shared/Toggle'
import { BenchmarkControls } from './BenchmarkControls'
import { NotesModal } from './NotesModal'
import { RecommendationIcon } from './RecommendationIcon'
import { RecommendationLegend } from './RecommendationLegend'

type BenchmarkProgressProps = {
  progress: ProgressModel
}

function EnergyCell({ s, g, si, hasEnergy }: { s: any, g: any, si: number, hasEnergy: boolean }) {
  if (!hasEnergy) return null

  // Group Energy (vt-energy style)
  if (s.energy == null && g.energy != null) {
    if (si === 0) {
      return (
        <div className="text-[12px] text-primary flex items-center justify-center" style={{ gridRow: `span ${g.scenarios.length}` }}>
          {numberFmt(Number(g.energy))}
        </div>
      )
    }
    return null
  }

  // Scenario Energy (ra-s5 style)
  return (
    <div className="text-[12px] text-primary flex items-center justify-center">
      {s.energy != null ? numberFmt(Number(s.energy)) : MISSING_STR}
    </div>
  )
}

export function BenchmarkProgress({ progress }: BenchmarkProgressProps) {
  const rankDefs = progress?.ranks || []

  const categories = progress?.categories || []

  // Global data: recent scenarios and sessions to inform recommendations
  const scenarios = useStore(s => s.scenarios)
  const sessions = useStore(s => s.sessions)

  // Ref to horizontal scroll container
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Helper: small triangle glyph like SummaryStats
  const triangle = (dir: 'up' | 'down', colorVar: string) => (
    <span
      className="inline-block align-[-2px] text-[10px] leading-none"
      style={{ color: `var(${colorVar})` }}
      aria-hidden
    >
      {dir === 'up' ? '▲' : '▼'}
    </span>
  )

  // Resizable scenario column state (effects & dynamic columns defined after rank visibility calc)
  const { scenarioWidth, onHandleMouseDown } = useResizableScenarioColumn({ initialWidth: 220, min: 140, max: 600 })

  const overallRankName = rankDefs[(progress?.overallRank ?? 0) - 1]?.name || MISSING_STR
  const [hScrollEnabled, setHScrollEnabled] = usePageState<boolean>('bench:progress:horizontalScroll', true)
  const [compactMode, setCompactMode] = usePageState<boolean>('bench:progress:compactMode', false)
  const [showLegend, setShowLegend] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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

  // Constants for non-rank columns
  const REC_W = RECOMMEND_COL_WIDTH, PLAY_W = PLAY_COL_WIDTH, SCORE_W = SCORE_COL_WIDTH, NOTES_W = NOTES_COL_WIDTH, ENERGY_W = ENERGY_COL_WIDTH, PAD_W = PADDING_COL_WIDTH
  // Dynamic grid columns (flex growth for ranks): Scenario | Pad | Notes | Recom | Play | Pad | Score | Rank1..N
  const dynamicColumns = useMemo(() => {
    const rankTracks = visibleRankIndices.map(() => `minmax(${RANK_MIN_WIDTH}px,1fr)`).join(' ')
    return `${Math.round(scenarioWidth)}px ${PAD_W}px ${NOTES_W}px ${REC_W}px ${PLAY_W}px ${PAD_W}px ${SCORE_W}px ${rankTracks}${hasEnergy ? ` ${ENERGY_W}px` : ''}`
  }, [scenarioWidth, visibleRankIndices.length, hasEnergy])

  // Attach refined wheel scroll: only enable horizontal wheel mapping when
  // the cursor is over the rank columns. We compute the left-offset where ranks begin.
  useHorizontalWheelScroll(containerRef, { excludeLeftWidth: scenarioWidth + PAD_W + REC_W + NOTES_W + PLAY_W + PAD_W + SCORE_W, enabled: hScrollEnabled })
  // Drag-> allow grabbing container to scroll horizontally (skip interactive elements / resize handles)
  // Always enable drag-to-scroll regardless of the wheel mapping toggle
  useDragScroll(containerRef, { axis: 'x', skipSelector: 'button, a, input, textarea, select, [role="button"]' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-primary">
        <div>
          Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmarkProgress)}</span>
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
                      <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>
                      <div className="text-[11px] text-secondary uppercase tracking-wide text-center" title="Recommendation score"></div>
                      <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>
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
              const displayCatColor = catColor ? `color-mix(in srgb, ${catColor} 85%, white)` : 'var(--text-primary)'

              return (
                <div key={catName} className={`border border-primary rounded bg-surface-3 overflow-hidden ${compactMode ? 'mt-1' : 'mt-3'}`}>
                  <div className="flex">
                    {/* Category vertical label with fixed width for alignment */}
                    <div className="w-8 px-1 py-2 flex items-center justify-center">
                      <span
                        className={`font-bold tracking-wide ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}
                        style={{
                          color: displayCatColor,
                          textShadow: `0 0 20px ${catColor || 'var(--text-primary)'}`,
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)'
                        }}
                      >
                        {catName}
                      </span>
                    </div>
                    <div className={`flex-1 p-2 ${compactMode ? 'space-y-1' : 'space-y-3'}`}>
                      {groups.map((g, gi) => {
                        const displaySubColor = g.color ? `color-mix(in srgb, ${g.color} 85%, white)` : 'var(--text-primary)'
                        return (
                          <div key={gi} className="flex gap-2">
                            {/* Subcategory vertical label with fixed width for alignment */}
                            <div className="w-6 pr-2 flex items-center justify-center flex-shrink-0">
                              {g.name ? (
                                <span
                                  className={`font-bold tracking-wide ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}
                                  style={{
                                    color: displaySubColor,
                                    textShadow: `0 0 15px ${g.color || 'var(--text-primary)'}`,
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
                                {g.scenarios.map((s, si) => {
                                  const sName = s.name
                                  const achieved = s.scenarioRank
                                  const maxes: number[] = s.thresholds
                                  const score = s.score
                                  const totalRec = recScore.get(sName) ?? 0
                                  const isTopPick = topPicks.has(sName)
                                  const isCompleted = achieved != null && maxes && achieved >= (maxes.length - 1)
                                  const rankColor = computeFillColor(achieved, ranks)

                                  return (
                                    <Fragment key={sName}>
                                      <div className={`${compactMode ? 'text-[11px]' : 'text-[13px]'} text-primary truncate flex items-center`}>
                                        <div className="w-1 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: rankColor }} />
                                        {sName}
                                      </div>
                                      <div />
                                      <div className="flex items-center justify-center">
                                        <button
                                          className={`${compactMode ? 'p-0.5' : 'p-1'} rounded hover:bg-surface-3 border border-transparent hover:border-primary ${settings?.scenarioNotes?.[sName]?.notes ? 'text-accent' : 'text-secondary'}`}
                                          title="Notes & Sensitivity"
                                          onClick={() => openNotes(sName)}
                                          aria-label={`Notes for ${sName}`}
                                        >
                                          <NotebookPen size={compactMode ? 14 : 16} />
                                        </button>
                                      </div>
                                      <div className="text-[12px] flex items-center justify-center" title={`Recommendation score: ${totalRec}`}>
                                        <RecommendationIcon score={totalRec} compact={compactMode} isTopPick={isTopPick} isCompleted={isCompleted} />
                                      </div>
                                      <div className="flex items-center justify-center">
                                        <button
                                          className={`${compactMode ? 'p-0.5' : 'p-1'} rounded hover:bg-surface-3 border border-transparent hover:border-primary`}
                                          title="Play in Kovaak's"
                                          onClick={() => launchScenario(sName, 'challenge').catch(() => { /* ignore */ })}
                                          aria-label={`Play ${sName} in Kovaak's`}
                                        >
                                          <Play size={compactMode ? 14 : 16} />
                                        </button>
                                      </div>
                                      <div />
                                      <div className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} text-primary flex items-center`}>{numberFmt(score)}</div>
                                      {visibleRankIndices.map((ri) => {
                                        const r = ranks[ri]
                                        const fill = cellFill(ri, score, maxes)
                                        // Use the last achieved rank's color for the fill. When no rank achieved, fallback to gray.
                                        const fillColor = computeFillColor(achieved, ranks)
                                        const value = maxes?.[ri + 1]
                                        return (
                                          <div key={r.name + ri} className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} text-center px-4 rounded relative overflow-hidden flex items-center justify-center bg-surface-2`}>
                                            <div className="absolute inset-y-0 left-0 rounded-l transition-all duration-150" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
                                            <span className={`relative z-10 w-full h-full ${compactMode ? 'py-0' : 'py-1'} flex items-center justify-center`} style={{ background: "radial-gradient(circle, var(--shadow-secondary), rgba(0, 0, 0, 0))" }}>{value != null ? numberFmt(value) : MISSING_STR}</span>
                                          </div>
                                        )
                                      })}
                                      <EnergyCell s={s} g={g} si={si} hasEnergy={hasEnergy} />
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
      )}
      {/* Controls panel: placed under the progress content */}
      {/* Moved to modals */}

      <Modal isOpen={showLegend} onClose={() => setShowLegend(false)} title="Recommendation Legend" width="600px" height="auto">
        <div className="p-4">
          <RecommendationLegend embedded />
        </div>
      </Modal>

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Rank Column Settings" width="600px" height="auto">
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
            embedded
          />
        </div>
      </Modal>

      {modalState.open && (
        <NotesModal
          isOpen={modalState.open}
          scenarioName={modalState.scenario}
          initialNotes={modalState.notes}
          initialSens={modalState.sens}
          onClose={() => setModalState(s => ({ ...s, open: false }))}
          onSave={saveNotes}
        />
      )}
    </div>
  )
}

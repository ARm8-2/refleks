import { Play } from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll'
import { useResizableScenarioColumn } from '../../hooks/useResizableScenarioColumn'
import { useStore } from '../../hooks/useStore'
import { groupByScenario } from '../../lib/analysis/metrics'
import { autoHiddenRanks, cellFill, computeFillColor, computeRecommendationScores, numberFmt, PLAY_COL_WIDTH, RANK_MIN_WIDTH, RECOMMEND_COL_WIDTH, SCORE_COL_WIDTH, thresholdContribution } from '../../lib/benchmarks'
import { launchScenario } from '../../lib/internal'
import { getScenarioName, MISSING_STR } from '../../lib/utils'
import type { BenchmarkProgress as ProgressModel } from '../../types/ipc'
import { Button } from '../shared/Button'
import { Dropdown } from '../shared/Dropdown'
import { Toggle } from '../shared/Toggle'

type BenchmarkProgressProps = {
  progress: ProgressModel
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

  const byName = useMemo(() => groupByScenario(scenarios), [scenarios])
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
  const lastPlayedMs = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of scenarios) {
      const n = getScenarioName(it)
      if (map.has(n)) continue
      const ms = Date.parse(String(it.stats?.['Date Played'] ?? ''))
      if (Number.isFinite(ms)) map.set(n, ms)
    }
    return map
  }, [scenarios])

  // Recommendation score per scenario name (base score without threshold proximity)
  const recScore = useMemo(() => computeRecommendationScores({ wantedNames, byName, lastPlayedMs, lastSessionCount, sessions }), [wantedNames, byName, lastPlayedMs, lastSessionCount, sessions])

  // Ranks visibility controls
  const [autoHideCleared, setAutoHideCleared] = useState<boolean>(true)
  const [manuallyHidden, setManuallyHidden] = useState<Set<number>>(() => new Set())
  // Desired number of rank columns to keep visible (when auto-hide is enabled)
  const [visibleRankCount, setVisibleRankCount] = useState<number>(4)

  // Flatten all scenarios visible in this benchmark view
  const allScenarios = useMemo(() => {
    const list: Array<{ scenarioRank: number }> = []
    for (const { groups } of categories) {
      for (const g of groups) {
        for (const s of g.scenarios) list.push({ scenarioRank: Number(s.scenarioRank || 0) })
      }
    }
    return list
  }, [categories])

  // Auto-hide any rank where ALL scenarios have surpassed that rank
  const autoHidden = useMemo(() => {
    const n = rankDefs.length
    // Precompute flat scenario rank array
    const ranksArr = allScenarios.map(s => Number(s.scenarioRank || 0))
    return autoHiddenRanks(n, ranksArr, autoHideCleared, visibleRankCount)
  }, [rankDefs.length, allScenarios, autoHideCleared, visibleRankCount])

  // Combine manual + auto hidden sets
  const effectiveHidden = useMemo(() => {
    const out = new Set<number>()
    manuallyHidden.forEach(i => out.add(i))
    autoHidden.forEach(i => out.add(i))
    return out
  }, [manuallyHidden, autoHidden])

  // Compute the visible rank indices and rank defs. Ensure at least one is visible.
  const visibleRankIndices = useMemo(() => {
    const n = rankDefs.length
    const all = Array.from({ length: n }, (_, i) => i)
    let vis = all.filter(i => !effectiveHidden.has(i))
    if (vis.length === 0 && n > 0) vis = [n - 1] // always show the top rank if everything would be hidden
    return vis
  }, [rankDefs.length, effectiveHidden])

  const visibleRanks = useMemo(() => visibleRankIndices.map(i => rankDefs[i]), [visibleRankIndices, rankDefs])

  // Constants for non-rank columns
  const REC_W = RECOMMEND_COL_WIDTH, PLAY_W = PLAY_COL_WIDTH, SCORE_W = SCORE_COL_WIDTH
  // Dynamic grid columns (flex growth for ranks): Scenario | Recom | Play | Score | Rank1..N
  const dynamicColumns = useMemo(() => {
    const rankTracks = visibleRankIndices.map(() => `minmax(${RANK_MIN_WIDTH}px,1fr)`).join(' ')
    return `${Math.round(scenarioWidth)}px ${REC_W}px ${PLAY_W}px ${SCORE_W}px ${rankTracks}`
  }, [scenarioWidth, visibleRankIndices.length])

  // Attach refined wheel scroll: only active when cursor is to right of Scenario+Recom prefix
  useHorizontalWheelScroll(containerRef, { excludeLeftWidth: scenarioWidth + REC_W })

  // Handlers for manual toggles
  const toggleManualRank = (idx: number) => {
    setManuallyHidden(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }
  const resetManual = () => setManuallyHidden(new Set())

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-primary)]">
        Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmarkProgress)}</span>
      </div>

      {categories && (
        <div className="overflow-x-auto" ref={containerRef}>
          <div className="min-w-max">
            {/* Single sticky header aligned with all categories */}
            <div className="sticky top-0">
              <div className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden">
                <div className="flex gap-2 px-2 py-2">
                  {/* Placeholders for category and subcategory label columns */}
                  <div className="w-8 flex-shrink-0" />
                  <div className="w-8 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="grid gap-1" style={{ gridTemplateColumns: dynamicColumns }}>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide relative select-none" style={{ width: scenarioWidth }}>
                        <span>Scenario</span>
                        {/* Drag handle */}
                        <div
                          onMouseDown={onHandleMouseDown}
                          className="absolute top-0 right-0 h-full w-2 cursor-col-resize group"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Resize scenario column"
                        >
                          <div className="h-full w-px bg-[var(--border-secondary)] group-hover:bg-[var(--accent-primary)]" />
                        </div>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center" title="Recommendation score (negative means: switch)">Recom</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">Play</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                      {visibleRanks.map(r => (
                        <div key={r.name} className="text-[11px] uppercase tracking-wide text-center" style={{ color: r.color || 'var(--text-secondary)' }}>{r.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Category cards content (no repeated headers) */}
            {categories.map(({ name: catName, color: catColor, groups }) => {
              const ranks = rankDefs
              return (
                <div key={catName} className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden mt-3">
                  <div className="flex">
                    {/* Category vertical label with fixed width for alignment */}
                    <div className="w-8 px-1 py-2 flex items-center justify-center">
                      <span className="text-[10px] font-semibold" style={{ color: catColor || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{catName}</span>
                    </div>
                    <div className="flex-1 p-2 space-y-3">
                      {groups.map((g, gi) => (
                        <div key={gi} className="flex gap-2">
                          {/* Subcategory vertical label with fixed width for alignment */}
                          <div className="w-8 px-1 py-2 flex items-center justify-center flex-shrink-0">
                            {g.name ? (
                              <span className="text-[10px] font-semibold" style={{ color: g.color || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{g.name}</span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-secondary)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{MISSING_STR}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-max">
                            <div className="grid gap-1" style={{ gridTemplateColumns: dynamicColumns }}>
                              {g.scenarios.map((s) => {
                                const sName = s.name
                                const achieved = s.scenarioRank
                                const maxes: number[] = s.thresholds
                                const score = s.score
                                const base = recScore.get(sName) ?? 0
                                const thPts = thresholdContribution(Number(achieved || 0), Number(score || 0), maxes, ranks.length)
                                const totalRec = Math.round(base + thPts)
                                return (
                                  <Fragment key={sName}>
                                    <div className="text-[13px] text-[var(--text-primary)] truncate flex items-center">{sName}</div>
                                    <div className="text-[12px] text-[var(--text-primary)] flex items-center justify-center gap-1" title="Recommendation score">
                                      {triangle(totalRec >= 0 ? 'up' : 'down', totalRec >= 0 ? '--success' : '--error')}
                                      <span>{totalRec}</span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                      <button
                                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-primary)]"
                                        title="Play in Kovaak's"
                                        onClick={() => launchScenario(sName, 'challenge').catch(() => { /* ignore */ })}
                                      >
                                        <Play size={16} />
                                      </button>
                                    </div>
                                    <div className="text-[12px] text-[var(--text-primary)] flex items-center">{numberFmt(score)}</div>
                                    {visibleRankIndices.map((ri) => {
                                      const r = ranks[ri]
                                      const fill = cellFill(ri, score, maxes)
                                      // Use the last achieved rank's color for the fill. When no rank achieved, fallback to gray.
                                      const fillColor = computeFillColor(achieved, ranks)
                                      const value = maxes?.[ri + 1]
                                      return (
                                        <div key={r.name + ri} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden flex items-center justify-center bg-[var(--bg-secondary)] border-0">
                                          <div className="absolute inset-y-0 left-0 rounded-l transition-all duration-150" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
                                          <span className="relative z-10">{value != null ? numberFmt(value) : MISSING_STR}</span>
                                        </div>
                                      )
                                    })}
                                  </Fragment>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Controls panel: placed under the progress content */}
      <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">Rank columns</div>
          <div className="flex items-center gap-3">
            <Toggle
              size="sm"
              label="Auto-hide earlier ranks"
              checked={autoHideCleared}
              onChange={setAutoHideCleared}
            />
            <Dropdown
              size="sm"
              label="Keep columns visible"
              ariaLabel="Target number of visible rank columns"
              value={String(visibleRankCount)}
              onChange={v => setVisibleRankCount(Math.max(1, parseInt(v || '1', 10) || 1))}
              options={Array.from({ length: Math.max(9, rankDefs.length) }, (_, i) => i + 1).map(n => ({ label: String(n), value: String(n) }))}
            />
            <Button size="sm" variant="ghost" onClick={resetManual} title="Reset manual visibility">Reset</Button>
          </div>
        </div>
        <div className="p-3">
          <div className="text-xs text-[var(--text-secondary)] mb-2">Toggle columns to show/hide. Auto-hidden columns are disabled.</div>
          <div className="flex flex-wrap gap-1">
            {rankDefs.map((r, i) => {
              const auto = autoHidden.has(i)
              const manualHidden = manuallyHidden.has(i)
              const visible = !(auto || manualHidden)
              return (
                <Button
                  key={r.name + i}
                  size="sm"
                  variant={visible ? 'secondary' : 'ghost'}
                  onClick={() => toggleManualRank(i)}
                  disabled={auto}
                  className={auto ? 'opacity-60 cursor-not-allowed' : ''}
                  title={auto ? 'Hidden automatically (all scenarios are past this rank)' : (visible ? 'Click to hide this column' : 'Click to show this column')}
                  style={{ color: r.color || 'var(--text-secondary)' }}
                >
                  {r.name}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

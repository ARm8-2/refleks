import { Play } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { groupByScenario } from '../../lib/analysis/metrics'
import { autoHiddenRanks, cellFill, computeRecommendationScores, gridCols, hexToRgba, numberFmt } from '../../lib/benchmarks'
import { launchScenario } from '../../lib/internal'
import { getScenarioName } from '../../lib/utils'
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

  // Ref to the horizontal scroll container so we can map vertical wheel -> horizontal scroll
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Attach a native wheel listener with { passive: false } so preventDefault() works
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handler = (e: WheelEvent) => {
      // Only convert vertical wheel gestures to horizontal scroll when there is overflow
      if (el.scrollWidth <= el.clientWidth) return

      const deltaX = e.deltaX
      const deltaY = e.deltaY
      // If the user is primarily scrolling horizontally, don't interfere
      if (Math.abs(deltaY) <= Math.abs(deltaX)) return

      const atLeft = el.scrollLeft === 0
      const atRight = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth
      const goingRight = deltaY > 0
      const goingLeft = deltaY < 0
      const willScroll = (goingRight && !atRight) || (goingLeft && !atLeft)
      if (willScroll) {
        el.scrollLeft += deltaY
        e.preventDefault()
        e.stopPropagation()
      }
    }

    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

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

  const grid = gridCols

  const overallRankName = rankDefs[(progress?.overallRank ?? 0) - 1]?.name || '—'

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
                    <div className="grid gap-1" style={{ gridTemplateColumns: grid(visibleRanks.length) }}>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Scenario</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center" title="Recommendation score (negative means: switch)">Recom</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">Play</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                      {visibleRanks.map(r => (
                        <div key={r.name} className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">{r.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Category cards content (no repeated headers) */}
            {categories.map(({ name: catName, color: catColor, groups }) => {
              const ranks = rankDefs
              const cols = grid(visibleRanks.length)
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
                              <span className="text-[10px] text-[var(--text-secondary)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>—</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-max">
                            <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                              {g.scenarios.map((s) => {
                                const sName = s.name
                                const achieved = s.scenarioRank
                                const maxes: number[] = s.thresholds
                                const score = s.score
                                // Threshold proximity contribution: push when close to next rank
                                let thPts = 0
                                if (maxes.length > 1) {
                                  const rankN = ranks.length
                                  const idx = Math.max(0, Math.min(rankN, achieved))
                                  const prev = maxes[idx] ?? 0
                                  const next = maxes[idx + 1] ?? null
                                  if (next != null && next > prev) {
                                    const frac = Math.max(0, Math.min(1, (score - prev) / (next - prev)))
                                    thPts = 40 * frac
                                  }
                                  // Rank deficiency: prioritize weaker scenarios
                                  const achievedNorm = Math.max(0, Math.min(1, achieved / Math.max(1, rankN)))
                                  thPts += 20 * (1 - achievedNorm)
                                }
                                const base = recScore.get(sName) ?? 0
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
                                      const border = r.color
                                      const value = maxes?.[ri + 1]
                                      return (
                                        <div key={r.name + ri} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden flex items-center justify-center" style={{ border: `1px solid ${border}` }}>
                                          <div className="absolute inset-y-0 left-0" style={{ width: `${Math.round(fill * 100)}%`, background: hexToRgba(r.color, 0.35) }} />
                                          <span className="relative z-10">{value != null ? numberFmt(value) : '—'}</span>
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

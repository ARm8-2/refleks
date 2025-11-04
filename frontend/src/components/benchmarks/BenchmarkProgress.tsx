import { Play } from 'lucide-react'
import React, { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../../hooks/useStore'
import { groupByScenario } from '../../lib/analysis/metrics'
import { computeRecommendationScores } from '../../lib/benchmarks/recommendation'
import { buildMetaDefs, buildRankDefs, cellFill, gridCols, hexToRgba, initialThresholdBaseline, normalizeProgress, numberFmt } from '../../lib/benchmarks/utils'
import { launchScenario } from '../../lib/internal'
import { getScenarioName } from '../../lib/utils'
import type { Benchmark } from '../../types/ipc'

type BenchmarkProgressProps = {
  bench: Benchmark
  difficultyIndex: number
  progress: Record<string, any>
}

export function BenchmarkProgress({ bench, difficultyIndex, progress }: BenchmarkProgressProps) {
  const difficulty = bench.difficulties[difficultyIndex]
  const rankDefs = useMemo(() => buildRankDefs(difficulty, progress), [difficulty, progress])

  const categories = progress?.categories as Record<string, any>

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

  const metaDefs = useMemo(() => buildMetaDefs(difficulty as any), [difficulty])

  const grid = gridCols

  const overallRankName = rankDefs[(progress?.overall_rank ?? 0) - 1]?.name || '—'

  // Map API progress to metadata strictly by order and counts; ignore API category names
  const normalized = useMemo(() => normalizeProgress(categories ? { categories } as any : undefined, metaDefs), [categories, metaDefs])

  // Build name sets and historical metrics used for recommendations
  const wantedNames = useMemo(() => {
    const set = new Set<string>()
    for (const { groups } of normalized) {
      for (const g of groups) {
        for (const [name] of g.scenarios) set.add(String(name))
      }
    }
    return Array.from(set)
  }, [normalized])

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

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-primary)]">
        Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmark_progress)}</span>
      </div>

      {categories && (
        <div className="overflow-x-auto" ref={containerRef}>
          <div className="min-w-max">
            {/* Single sticky header aligned with all categories */}
            <div className="sticky top-0 z-10">
              <div className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden">
                <div className="flex gap-2 px-2 py-2">
                  {/* Placeholders for category and subcategory label columns */}
                  <div className="w-8 flex-shrink-0" />
                  <div className="w-8 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="grid gap-1" style={{ gridTemplateColumns: grid(rankDefs.length) }}>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Scenario</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center" title="Recommendation score (negative means: switch)">Recom</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">Play</div>
                      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                      {rankDefs.map(r => (
                        <div key={r.name} className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">{r.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Category cards content (no repeated headers) */}
            {normalized.map(({ catName, catColor, groups }) => {
              const ranks = rankDefs
              const cols = grid(ranks.length)
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
                              {g.scenarios.map(([sName, s]) => {
                                const achieved = Number(s?.scenario_rank || 0)
                                const maxes: number[] = Array.isArray(s?.rank_maxes) ? s.rank_maxes : []
                                const raw = Number(s?.score || 0)
                                const score = raw / 100 // API returns score * 100; thresholds are in natural units
                                // Threshold proximity contribution: push when close to next rank
                                let thPts = 0
                                if (Array.isArray(maxes) && maxes.length > 0) {
                                  const idx = Math.max(0, Math.min(maxes.length, achieved))
                                  const prev = idx > 0 ? (maxes[idx - 1] ?? 0) : initialThresholdBaseline(maxes)
                                  const next = maxes[idx] ?? null
                                  if (next != null && next > prev) {
                                    const frac = Math.max(0, Math.min(1, (score - prev) / (next - prev)))
                                    thPts = 40 * frac
                                  }
                                  // Rank deficiency: prioritize weaker scenarios
                                  const achievedNorm = Math.max(0, Math.min(1, achieved / Math.max(1, maxes.length)))
                                  thPts += 20 * (1 - achievedNorm)
                                }
                                const base = recScore.get(String(sName)) ?? 0
                                const totalRec = Math.round(base + thPts)
                                return (
                                  <React.Fragment key={sName}>
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
                                    {ranks.map((r, i) => {
                                      const fill = cellFill(i, score, maxes)
                                      const border = r.color
                                      const value = maxes?.[i]
                                      return (
                                        <div key={r.name + i} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden flex items-center justify-center" style={{ border: `1px solid ${border}` }}>
                                          <div className="absolute inset-y-0 left-0" style={{ width: `${Math.round(fill * 100)}%`, background: hexToRgba(r.color, 0.35) }} />
                                          <span className="relative z-10">{value != null ? numberFmt(value) : '—'}</span>
                                        </div>
                                      )
                                    }
                                    )}
                                  </React.Fragment>
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
    </div>
  )
}

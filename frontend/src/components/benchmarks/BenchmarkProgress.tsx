import { Play } from 'lucide-react'
import React, { useMemo } from 'react'
import { launchScenario } from '../../lib/internal'
import type { Benchmark } from '../../types/ipc'
import { buildRankDefs, cellFill, gridCols, hexToRgba, numberFmt } from './utils'

type Props = {
  bench: Benchmark
  difficultyIndex: number
  progress: Record<string, any>
}

export function BenchmarkProgress({ bench, difficultyIndex, progress }: Props) {
  const difficulty = bench.difficulties[difficultyIndex]
  const rankDefs = useMemo(() => buildRankDefs(difficulty, progress), [difficulty, progress])

  const categories = progress?.categories as Record<string, any>

  const metaDefs = useMemo(() => {
    const defs: Array<{
      catName: string
      catColor?: string
      subDefs: Array<{ name: string; count: number; color?: string }>
    }> = []
    for (const c of difficulty.categories || []) {
      const catName = (c as any)?.categoryName as string
      const catColor = (c as any)?.color as string | undefined
      const subs = Array.isArray((c as any)?.subcategories) ? (c as any).subcategories : []
      const subDefs = subs.map((s: any) => ({
        name: String(s?.subcategoryName ?? ''),
        count: Number(s?.scenarioCount ?? 0),
        color: s?.color as string | undefined
      }))
      defs.push({ catName, catColor, subDefs })
    }
    return defs
  }, [difficulty])

  const grid = gridCols

  const overallRankName = rankDefs[(progress?.overall_rank ?? 0) - 1]?.name || '—'

  // Map API progress to metadata strictly by order and counts; ignore API category names
  const normalized = useMemo(() => {
    type ScenarioEntry = [string, any]
    const result: Array<{
      catName: string
      catColor?: string
      groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }>
    }> = []

    // Flatten all scenarios from the API in their given order
    const flat: ScenarioEntry[] = []
    if (categories) {
      for (const cat of Object.values(categories)) {
        const scenEntries = Object.entries((cat as any)?.scenarios || {}) as ScenarioEntry[]
        flat.push(...scenEntries)
      }
    }

    let pos = 0
    for (let i = 0; i < metaDefs.length; i++) {
      const { catName, catColor, subDefs } = metaDefs[i]
      const groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }> = []

      if (subDefs.length > 0) {
        for (const sd of subDefs) {
          const take = Math.max(0, Math.min(sd.count, flat.length - pos))
          const scenarios = take > 0 ? flat.slice(pos, pos + take) : []
          pos += take
          groups.push({ name: sd.name, color: sd.color, scenarios })
        }
      } else {
        // Fallback: no subcategories defined — keep an empty placeholder group
        groups.push({ name: '', color: undefined, scenarios: [] })
      }

      // Append any leftovers at the very end (final category only)
      if (i === metaDefs.length - 1 && pos < flat.length) {
        groups.push({ name: '', color: undefined, scenarios: flat.slice(pos) })
        pos = flat.length
      }

      result.push({ catName, catColor, groups })
    }

    return result
  }, [categories, metaDefs])

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-primary)]">
        Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmark_progress)}</span>
      </div>

      {categories && (
        <div className="overflow-x-auto">
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
                                return (
                                  <React.Fragment key={sName}>
                                    <div className="text-[13px] text-[var(--text-primary)] truncate flex items-center">{sName}</div>
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
                                      const fill = cellFill(i, achieved, score, maxes)
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

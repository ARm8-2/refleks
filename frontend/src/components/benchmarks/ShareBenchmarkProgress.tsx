import React, { useMemo } from 'react'
import { buildRankDefs, cellFill, gridColsShare, hexToRgba, numberFmt } from '../../lib/benchmarks/utils'
import type { Benchmark } from '../../types/ipc'

const LOGO_URL = new URL('../../assets/logo.svg', import.meta.url).href

export type ShareBenchmarkProgressProps = {
  bench: Benchmark
  difficultyIndex: number
  progress: Record<string, any>
}

// A print/share-friendly card that summarizes BenchmarkProgress without the
// recommendation (Recom) or Play columns. Intended to be rendered offscreen
// and converted to an image for sharing.
export function ShareBenchmarkProgress({ bench, difficultyIndex, progress }: ShareBenchmarkProgressProps) {
  const difficulty = bench.difficulties[difficultyIndex]
  const rankDefs = useMemo(() => buildRankDefs(difficulty, progress), [difficulty, progress])
  const categories = progress?.categories as Record<string, any>

  const overallRankName = rankDefs[(progress?.overall_rank ?? 0) - 1]?.name || '—'

  // Build UI metadata from difficulty to normalize API categories
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
        color: s?.color as string | undefined,
      }))
      defs.push({ catName, catColor, subDefs })
    }
    return defs
  }, [difficulty])

  // Normalize API categories to match the difficulty metadata ordering
  const normalized = useMemo(() => {
    type ScenarioEntry = [string, any]
    const result: Array<{
      catName: string
      catColor?: string
      groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }>
    }> = []

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
        groups.push({ name: '', color: undefined, scenarios: [] })
      }

      if (i === metaDefs.length - 1 && pos < flat.length) {
        groups.push({ name: '', color: undefined, scenarios: flat.slice(pos) })
        pos = flat.length
      }

      result.push({ catName, catColor, groups })
    }

    return result
  }, [categories, metaDefs])

  const cols = gridColsShare(rankDefs.length)

  return (
    <div className="w-full max-w-[1600px] rounded-lg border border-[var(--border-primary)]" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header / Branding */}
      <div className="px-6 pt-5 pb-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-h-[32px]">
            <img src={LOGO_URL} alt="RefleK's" className="h-8 w-auto object-contain" />
            <div className="text-lg font-semibold">RefleK's</div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">refleks-app.com</div>
        </div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          Benchmark: <span className="font-medium text-[var(--text-primary)]">{bench.abbreviation} {bench.benchmarkName}</span> · Difficulty: <span className="font-medium text-[var(--text-primary)]">{difficulty?.difficultyName}</span>
        </div>
        <div className="mt-1 text-sm text-[var(--text-primary)]">
          Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmark_progress)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {/* Sticky-style header replicated (no Recom/Play) */}
        <div className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden">
          <div className="flex gap-2 px-2 py-2">
            {/* Placeholders for category and subcategory label columns */}
            <div className="w-8 flex-shrink-0" />
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1">
              <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Scenario</div>
                <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                {rankDefs.map(r => (
                  <div key={r.name} className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">{r.name}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category groups */}
        {normalized.map(({ catName, catColor, groups }) => (
          <div key={catName} className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden mt-3">
            <div className="flex">
              <div className="w-8 px-1 py-2 flex items-center justify-center">
                <span className="text-[10px] font-semibold" style={{ color: catColor || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{catName}</span>
              </div>
              <div className="flex-1 p-2 space-y-3">
                {groups.map((g, gi) => (
                  <div key={gi} className="flex gap-2">
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
                          const maxes: number[] = Array.isArray(s?.rank_maxes) ? s.rank_maxes : []
                          const raw = Number(s?.score || 0)
                          const score = raw / 100
                          return (
                            <React.Fragment key={sName}>
                              <div className="text-[13px] text-[var(--text-primary)] truncate flex items-center">{sName}</div>
                              <div className="text-[12px] text-[var(--text-primary)] flex items-center">{numberFmt(score)}</div>
                              {rankDefs.map((r, i) => {
                                const fill = cellFill(i, score, maxes)
                                const border = r.color
                                const value = maxes?.[i]
                                return (
                                  <div key={r.name + i} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden flex items-center justify-center" style={{ border: `1px solid ${border}` }}>
                                    <div className="absolute inset-y-0 left-0" style={{ width: `${Math.round(fill * 100)}%`, background: hexToRgba(r.color, 0.35) }} />
                                    <span className="relative z-10">{value != null ? numberFmt(value) : '—'}</span>
                                  </div>
                                )
                              })}
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
        ))}

        {/* Footer note */}
        <div className="mt-4 text-[11px] text-[var(--text-secondary)]">
          Generated with RefleK's — share your progress
        </div>
      </div>
    </div>
  )
}

export default ShareBenchmarkProgress

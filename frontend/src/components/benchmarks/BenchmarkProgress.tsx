import { Play } from 'lucide-react'
import React, { useMemo } from 'react'
import { launchScenario } from '../../lib/internal'
import type { Benchmark } from '../../types/ipc'

type Props = {
  bench: Benchmark
  difficultyIndex: number
  progress: Record<string, any>
}

function buildRankDefs(
  difficulty: Benchmark['difficulties'][number],
  progress: Record<string, any> | undefined
): Array<{ name: string; color: string }> {
  const dc: Record<string, string> = (difficulty as any)?.rankColors || {}
  const ranks: Array<any> = Array.isArray((progress as any)?.ranks) ? (progress as any).ranks : []
  if (ranks.length > 0) {
    // Prefer server-provided rank order, map colors from difficulty.rankColors when available
    return ranks
      .filter(r => String(r?.name ?? '').toLowerCase() !== 'no rank')
      .map(r => ({
        name: String(r?.name ?? ''),
        color: dc[String(r?.name ?? '')] || String(r?.color ?? '#ffffff')
      }))
  }
  // Fallback: if server didn't provide ranks, derive from difficulty.rankColors (order may be implementation-defined)
  const dcEntries = Object.entries(dc)
  if (dcEntries.length > 0) {
    return dcEntries.map(([name, color]) => ({ name, color }))
  }
  return []
}

function hexToRgba(hex: string, alpha = 0.18): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return `rgba(255,255,255,${alpha})`
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function numberFmt(n: number | null | undefined): string {
  if (n == null || isNaN(+n)) return '—'
  try {
    return new Intl.NumberFormat().format(+n)
  } catch {
    return String(n)
  }
}

export function BenchmarkProgress({ bench, difficultyIndex, progress }: Props) {
  const difficulty = bench.difficulties[difficultyIndex]
  const rankDefs = useMemo(() => buildRankDefs(difficulty, progress), [difficulty, progress])

  const categories = progress?.categories as Record<string, any>
  const catDefs: Record<string, { color?: string; subcategories: Array<{ name: string; count: number; color?: string }> }> = useMemo(() => {
    const map: Record<string, { color?: string; subcategories: Array<{ name: string; count: number; color?: string }> }> = {}
    for (const c of difficulty.categories || []) {
      const name = (c as any).categoryName as string
      const subs = Array.isArray((c as any).subcategories) ? (c as any).subcategories : []
      map[name] = {
        color: (c as any).color as string | undefined,
        subcategories: subs.map((s: any) => ({ name: String(s?.subcategoryName ?? ''), count: Number(s?.scenarioCount ?? 0), color: s?.color as string | undefined }))
      }
    }
    return map
  }, [difficulty])

  const gridCols = (count: number) => `minmax(220px,1fr) 40px 90px ${Array.from({ length: count }).map(() => '120px').join(' ')}`

  const overallRankName = rankDefs[(progress?.overall_rank ?? 0) - 1]?.name || '—'

  // Compute fill fraction for rank cell index of a scenario
  function cellFill(index: number, scenarioRank: number, score: number, thresholds: number[]): number {
    const n = thresholds?.length ?? 0
    if (n === 0) return 0
    const current = Math.max(0, Math.min(n, Number(scenarioRank || 0))) - 1 // -1 when below first rank
    if (current < 0) {
      // below rank 1, partially fill first cell relative to first threshold
      if (index !== 0) return 0
      const t0 = thresholds[0] ?? 0
      if (t0 <= 0) return 0
      return Math.max(0, Math.min(1, (Number(score || 0)) / t0))
    }
    if (index < current) return 1
    if (index > current) return 0
    const prev = thresholds[current] ?? 0
    const next = thresholds[current + 1]
    if (next == null || next <= prev) return 1
    const frac = (Number(score || 0) - prev) / (next - prev)
    return Math.max(0, Math.min(1, frac))
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-primary)]">
        Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmark_progress)}</span>
      </div>

      {categories && Object.keys(categories).map((catName) => {
        const cat = categories[catName]
        const ranks = rankDefs
        const cols = gridCols(ranks.length)
        const catColor = catDefs[catName]?.color
        const subDefs = catDefs[catName]?.subcategories || []
        const scenEntries: Array<[string, any]> = Object.entries(cat?.scenarios || {})

        // Group scenarios by subcategory counts
        const groups: Array<{ sub: { name: string; color?: string }; scenarios: Array<[string, any]> }> = []
        let pos = 0
        for (const sub of subDefs) {
          const take = Math.max(0, Math.min(sub.count, scenEntries.length - pos))
          groups.push({ sub: { name: sub.name, color: sub.color }, scenarios: scenEntries.slice(pos, pos + take) })
          pos += take
        }
        if (pos < scenEntries.length) {
          // Any leftovers (mismatch between counts and server list) go into an unnamed bucket
          groups.push({ sub: { name: '', color: undefined }, scenarios: scenEntries.slice(pos) })
        }

        return (
          <div key={catName} className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden">
            <div className="flex">
              {/* Category vertical label with colored text instead of background */}
              <div className="px-1 py-2 flex items-center justify-center">
                <span className="text-[10px] font-semibold" style={{ color: catColor || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{catName}</span>
              </div>
              <div className="flex-1 p-2 overflow-x-auto space-y-3">
                {groups.map((g, gi) => (
                  <div key={gi} className="flex gap-2">
                    {/* Subcategory vertical label */}
                    <div className="px-1 py-2 flex items-center justify-center">
                      {g.sub.name ? (
                        <span className="text-[10px] font-semibold" style={{ color: g.sub.color || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{g.sub.name}</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-secondary)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>—</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                        <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Scenario</div>
                        <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">Play</div>
                        <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                        {ranks.map(r => (
                          <div key={r.name} className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">{r.name}</div>
                        ))}
                        {g.scenarios.map(([sName, s]) => {
                          const achieved = Number(s?.scenario_rank || 0)
                          const maxes: number[] = Array.isArray(s?.rank_maxes) ? s.rank_maxes : []
                          const raw = Number(s?.score || 0)
                          const score = raw / 100 // API returns score * 100; thresholds are in natural units
                          return (
                            <React.Fragment key={sName}>
                              <div className="text-[13px] text-[var(--text-primary)] truncate">{sName}</div>
                              <div className="flex items-center justify-center">
                                <button
                                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-primary)]"
                                  title="Play in Kovaak's"
                                  onClick={() => launchScenario(sName, 'challenge').catch(() => { /* ignore */ })}
                                >
                                  <Play size={16} />
                                </button>
                              </div>
                              <div className="text-[12px] text-[var(--text-primary)]">{numberFmt(score)}</div>
                              {ranks.map((r, i) => {
                                const fill = cellFill(i, achieved, score, maxes)
                                const border = r.color
                                const value = maxes?.[i]
                                return (
                                  <div key={r.name + i} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden" style={{ border: `1px solid ${border}` }}>
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
        )
      })}
    </div>
  )
}

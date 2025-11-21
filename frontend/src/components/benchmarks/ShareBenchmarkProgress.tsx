import { Fragment } from 'react'
import { REFLEKS_SYMBOL } from '../../assets'
import { cellFill, computeFillColor, gridColsShare, numberFmt } from '../../lib/benchmarks'
import { MISSING_STR } from '../../lib/utils'
import type { Benchmark, BenchmarkProgress } from '../../types/ipc'

export type ShareBenchmarkProgressProps = {
  bench: Benchmark
  difficultyIndex: number
  progress: BenchmarkProgress
}

// A print/share-friendly card that summarizes BenchmarkProgress without the
// recommendation (Recom) or Play columns. Intended to be rendered offscreen
// and converted to an image for sharing.
export function ShareBenchmarkProgress({ bench, difficultyIndex, progress }: ShareBenchmarkProgressProps) {
  const rankDefs = progress?.ranks || []
  const categories = progress?.categories || []

  const overallRankName = rankDefs[(progress?.overallRank ?? 0) - 1]?.name || MISSING_STR

  const cols = gridColsShare(rankDefs.length)

  return (
    <div className="w-full max-w-[1600px] rounded-lg border border-[var(--border-primary)]" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header / Branding */}
      <div className="px-6 pt-5 pb-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-h-[32px]">
            <img src={REFLEKS_SYMBOL} alt="RefleK's" className="h-8 w-auto object-contain" />
            <div className="text-lg font-semibold">RefleK's</div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">refleks-app.com</div>
        </div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          Benchmark: <span className="font-medium text-[var(--text-primary)]">{bench.abbreviation} {bench.benchmarkName}</span> · Difficulty: <span className="font-medium text-[var(--text-primary)]">{bench.difficulties?.[difficultyIndex]?.difficultyName}</span>
        </div>
        <div className="mt-1 text-sm text-[var(--text-primary)]">
          Overall Rank: <span className="font-medium">{overallRankName}</span> · Benchmark Progress: <span className="font-medium">{numberFmt(progress?.benchmarkProgress)}</span>
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
                  <div key={r.name} className="text-[11px] uppercase tracking-wide text-center" style={{ color: r.color || 'var(--text-secondary)' }}>{r.name}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category groups */}
        {categories.map(({ name: catName, color: catColor, groups }) => (
          <div key={catName} className="border border-[var(--border-primary)] rounded bg-[var(--bg-tertiary)] overflow-hidden mt-3">
            <div className="flex">
              <div className="w-8 px-1 py-2 flex items-center justify-center">
                <span className="text-[10px] font-semibold" style={{ color: catColor || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{catName}</span>
              </div>
              <div className="flex-1 p-2 space-y-3">
                {groups.map((g, gi) => (
                  <div key={gi} className="flex gap-2">
                    <div className="w-8 px-1 flex items-center justify-center flex-shrink-0">
                      {g.name ? (
                        <span className="text-[10px] font-semibold" style={{ color: g.color || 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{g.name}</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-secondary)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>-</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-max content-center">
                      <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                        {g.scenarios.map((s) => {
                          const sName = s.name
                          const maxes = s.thresholds
                          const score = s.score
                          return (
                            <Fragment key={sName}>
                              <div className="text-[13px] text-[var(--text-primary)] truncate flex items-center">{sName}</div>
                              <div className="text-[12px] text-[var(--text-primary)] flex items-center">{numberFmt(score)}</div>
                              {rankDefs.map((r, i) => {
                                const fill = cellFill(i, score, maxes)
                                const fillColor = computeFillColor(s?.scenarioRank, rankDefs)
                                const value = maxes?.[i + 1]
                                return (
                                  <div key={r.name + i} className="text-[12px] text-center px-4 rounded relative overflow-hidden flex items-center justify-center bg-[var(--bg-secondary)]">
                                    <div className="absolute inset-y-0 left-0 rounded-l transition-all duration-150" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
                                    <span className="relative z-10 w-full h-full py-1 flex items-center justify-center" style={{ background: "radial-gradient(circle, var(--shadow-secondary), rgba(0, 0, 0, 0))" }}>{value != null ? numberFmt(value) : MISSING_STR}</span>
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
        ))}

        {/* Footer note */}
        <div className="mt-4 text-[11px] text-[var(--text-secondary)]">
          Generated with RefleK's - share your progress
        </div>
      </div>
    </div>
  )
}

export default ShareBenchmarkProgress

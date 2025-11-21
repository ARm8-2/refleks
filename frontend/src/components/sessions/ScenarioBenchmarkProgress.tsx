import { useMemo, useRef } from 'react'
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll'
import { useResizableScenarioColumn } from '../../hooks/useResizableScenarioColumn'
import { cellFill, computeFillColor, numberFmt, RANK_MIN_WIDTH, SCORE_COL_WIDTH } from '../../lib/benchmarks'
import { MISSING_STR } from '../../lib/utils'
import type { Benchmark, BenchmarkProgress } from '../../types/ipc'
import { InfoBox } from '../shared/InfoBox'

type ScenarioBenchmarkProgressProps = {
  bench?: Benchmark | null
  progress?: BenchmarkProgress | null
  scenarioName: string
  selectedBenchId?: string | null
  loading?: boolean
  error?: string | null
}

export function ScenarioBenchmarkProgress({
  bench,
  progress,
  scenarioName,
  selectedBenchId = null,
  loading = false,
  error = null,
}: ScenarioBenchmarkProgressProps) {
  const HEIGHT = 110

  // Locate scenario progress in the opened benchmark progress payload
  const scenario = useMemo(() => {
    if (!progress || !scenarioName) return null
    const categories = progress.categories || []
    for (const cat of categories) {
      for (const g of (cat.groups || [])) {
        for (const s of (g.scenarios || [])) {
          if (s.name === scenarioName) return s
        }
      }
    }
    return null
  }, [progress, scenarioName])

  // Rank definitions from difficulty/progress (same as BenchmarkProgress)
  const ranks = useMemo(() => (progress?.ranks || []), [progress])

  const containerRef = useRef<HTMLDivElement | null>(null)

  // Resizable scenario column + dynamic grid columns
  const { scenarioWidth, onHandleMouseDown } = useResizableScenarioColumn({ initialWidth: 220, min: 140, max: 600 })
  // Columns: Scenario | Score | Rank1..N (each rank flexible)
  const dynamicColumns = useMemo(() => {
    const rankTracks = ranks.map(() => `minmax(${RANK_MIN_WIDTH}px,1fr)`).join(' ')
    return `${Math.round(scenarioWidth)}px ${SCORE_COL_WIDTH}px ${rankTracks}`
  }, [scenarioWidth, ranks.length])

  // Wheel -> horizontal scroll only when cursor is to right of Scenario + Score columns
  useHorizontalWheelScroll(containerRef, { excludeLeftWidth: scenarioWidth + SCORE_COL_WIDTH })

  return (
    <InfoBox
      title="Benchmark progress for this scenario"
      id="sessions:scenario-benchmark-progress"
      height={HEIGHT}
      bodyClassName="h-full overflow-hidden"
      info={
        <div className="h-full overflow-y-auto text-sm text-[var(--text-primary)] px-3 pt-2">
          <div>
            <div className="mb-2">Shows your progress towards benchmark ranks for the currently selected scenario. This follows the benchmark you have open on the Benchmarks page.</div>
            <ul className="list-disc pl-5 text-[var(--text-secondary)]">
              <li>Open a benchmark in the Benchmarks tab to display its progress here.</li>
              <li>If this scenario isn’t part of the opened benchmark, an info message is shown.</li>
            </ul>
          </div>
        </div>
      }
    >
      <div className="h-full overflow-x-auto px-3 py-1" ref={containerRef}>
        {(!selectedBenchId) && (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
            Open a benchmark in “Benchmarks” to see progress for this scenario here.
          </div>
        )}
        {(selectedBenchId && error) && (
          <div className="h-full flex items-center justify-center text-sm text-red-400">{error}</div>
        )}
        {(selectedBenchId && loading) && (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">Loading benchmark progress…</div>
        )}
        {(selectedBenchId && !loading && !error) && (
          bench && progress && scenario ? (
            <div className="w-full h-full flex items-center">
              <div className="grid gap-1 w-full" style={{ gridTemplateColumns: dynamicColumns }}>
                <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide relative select-none" style={{ width: scenarioWidth }}>
                  <span>Scenario</span>
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
                <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                {ranks.map((r: { name: string; color: string }) => (
                  <div key={r.name} className="text-[11px] uppercase tracking-wide text-center" style={{ color: r.color || 'var(--text-secondary)' }}>{r.name}</div>
                ))}
                {(() => {
                  const maxes = scenario.thresholds
                  const score = scenario.score
                  return (
                    <>
                      <div className="text-[13px] text-[var(--text-primary)] truncate flex items-center">{scenarioName}</div>
                      <div className="text-[12px] text-[var(--text-primary)] flex items-center">{numberFmt(score)}</div>
                      {ranks.map((r: { name: string; color: string }, i: number) => {
                        const fill = cellFill(i, score, maxes)
                        const fillColor = computeFillColor(scenario.scenarioRank, ranks)
                        const value = maxes?.[i + 1]
                        return (
                          <div key={r.name + i} className="text-[12px] text-center px-4 rounded relative overflow-hidden flex items-center justify-center bg-[var(--bg-secondary)]">
                            <div className="absolute inset-y-0 left-0 rounded-l transition-all duration-150" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
                            <span className="relative z-10 w-full h-full py-1 flex items-center justify-center" style={{ background: "radial-gradient(circle, var(--shadow-secondary), rgba(0, 0, 0, 0))" }}>{value != null ? numberFmt(value) : MISSING_STR}</span>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
              {bench && progress ? 'This scenario isn\'t part of the opened benchmark.' : 'Open a benchmark in “Benchmarks” to see progress for this scenario here.'}
            </div>
          )
        )}
      </div>
    </InfoBox>
  )
}

export default ScenarioBenchmarkProgress

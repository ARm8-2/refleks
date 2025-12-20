import { useMemo, useRef } from 'react'
import { useDragScroll } from '../../hooks/useDragScroll'
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll'
import { usePageState } from '../../hooks/usePageState'
import { useResizableScenarioColumn } from '../../hooks/useResizableScenarioColumn'
import { PADDING_COL_WIDTH, RANK_MIN_WIDTH, SCORE_COL_WIDTH } from '../../lib/benchmarks/layout'
import { cellFill, computeFillColor } from '../../lib/benchmarks/ui'
import { MISSING_STR } from '../../lib/constants'
import { formatNumber } from '../../lib/utils'
import type { Benchmark, BenchmarkProgress } from '../../types/ipc'
import { InfoBox } from '../shared/InfoBox'
import { Loading } from '../shared/Loading'
import { Toggle } from '../shared/Toggle'

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
  // Columns: Scenario | Pad | Score | Rank1..N (each rank flexible)
  const dynamicColumns = useMemo(() => {
    const rankTracks = ranks.map(() => `minmax(${RANK_MIN_WIDTH}px,1fr)`).join(' ')
    return `${Math.round(scenarioWidth)}px ${PADDING_COL_WIDTH}px ${SCORE_COL_WIDTH}px ${rankTracks}`
  }, [scenarioWidth, ranks.length])

  // Wheel -> horizontal scroll only when hovering over the rank columns
  // The ranks are placed after the scenario + pad + score columns, so only start mapping
  // when cursor is to the right of those columns.
  const [hScrollEnabled, setHScrollEnabled] = usePageState<boolean>('sessions:scenario-progress:horizontalScroll', true)
  useHorizontalWheelScroll(containerRef, { excludeLeftWidth: scenarioWidth + PADDING_COL_WIDTH + SCORE_COL_WIDTH, enabled: hScrollEnabled })
  // Drag -> allow grabbing and dragging to scroll horizontally for all columns (except interactive elements / resize handle)
  // Always enable drag-to-scroll regardless of the wheel mapping toggle
  useDragScroll(containerRef, { axis: 'x' })

  const infoContent = (
    <div className="h-full overflow-y-auto text-sm text-primary px-3 pt-2">
      <div>
        <div className="mb-2">Shows your progress towards benchmark ranks for the currently selected scenario. This follows the benchmark you have open on the Benchmarks page.</div>
        <ul className="list-disc pl-5 text-secondary">
          <li>Open a benchmark in the Benchmarks tab to display its progress here.</li>
          <li>If this scenario isn’t part of the opened benchmark, an info message is shown.</li>
        </ul>
      </div>
    </div>
  )

  return (
    <InfoBox
      title="Benchmark progress for this scenario"
      id="sessions:scenario-benchmark-progress"
      height={HEIGHT}
      bodyClassName="h-full overflow-hidden"
      info={infoContent}
      headerControls={<div className="flex items-center gap-2"><Toggle size="sm" label="Horizontal scroll" checked={hScrollEnabled} onChange={setHScrollEnabled} /></div>}
    >
      <div className="h-full overflow-x-auto px-3 py-1" ref={containerRef}>
        {(!selectedBenchId) && (
          <div className="h-full flex items-center justify-center text-sm text-secondary">
            Open a benchmark in “Benchmarks” to see progress for this scenario here.
          </div>
        )}
        {(selectedBenchId && error) && (
          <div className="h-full flex items-center justify-center text-sm text-red-400">{error}</div>
        )}
        {(selectedBenchId && loading) && (
          <Loading />
        )}
        {(selectedBenchId && !loading && !error) && (
          bench && progress && scenario ? (
            <div className="w-full h-full flex items-center">
              <div className="grid gap-1 w-full" style={{ gridTemplateColumns: dynamicColumns }}>
                <div className="text-[11px] text-secondary uppercase tracking-wide relative select-none" style={{ width: scenarioWidth }}>
                  <span>Scenario</span>
                  <div
                    onMouseDown={onHandleMouseDown}
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize group"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize scenario column"
                  >
                    <div className="h-full border-l border-secondary group-hover:border-accent" />
                  </div>
                </div>
                <div className="text-[11px] text-secondary uppercase tracking-wide text-center"></div>
                <div className="text-[11px] text-secondary uppercase tracking-wide">Score</div>
                {ranks.map((r: { name: string; color: string }) => (
                  <div key={r.name} className="text-[11px] uppercase tracking-wide text-center" style={{ color: r.color || 'var(--text-secondary)' }}>{r.name}</div>
                ))}
                {(() => {
                  const maxes = scenario.thresholds
                  const score = scenario.score
                  return (
                    <>
                      <div className="text-[13px] text-primary truncate flex items-center">{scenarioName}</div>
                      <div />
                      <div className="text-[12px] text-primary flex items-center">{formatNumber(score)}</div>
                      {ranks.map((r: { name: string; color: string }, i: number) => {
                        const fill = cellFill(i, score, maxes)
                        const fillColor = computeFillColor(scenario.scenarioRank, ranks)
                        const value = maxes?.[i + 1]
                        return (
                          <div key={r.name + i} className="text-[12px] text-center px-4 rounded relative overflow-hidden flex items-center justify-center bg-surface-2">
                            <div className="absolute inset-y-0 left-0 rounded-l transition-all duration-150" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
                            <span className="relative z-10 w-full h-full py-1 flex items-center justify-center" style={{ background: "radial-gradient(circle, var(--shadow-secondary), rgba(0, 0, 0, 0))" }}>{value != null ? formatNumber(value) : MISSING_STR}</span>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-secondary">
              {bench && progress ? 'This scenario isn\'t part of the opened benchmark.' : 'Open a benchmark in “Benchmarks” to see progress for this scenario here.'}
            </div>
          )
        )}
      </div>
    </InfoBox>
  )
}

export default ScenarioBenchmarkProgress

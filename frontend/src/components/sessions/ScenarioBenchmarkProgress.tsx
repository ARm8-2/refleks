import { Info } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cellFill, hexToRgba, numberFmt } from '../../lib/benchmarks'
import type { Benchmark, BenchmarkProgress } from '../../types/ipc'

type ScenarioBenchmarkProgressProps = {
  bench?: Benchmark | null
  progress?: BenchmarkProgress | null
  scenarioName: string
  // These let us render user feedback like in Sessions Overview
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
  const [showInfo, setShowInfo] = useState(false)
  const HEIGHT = 110
  const HEADER_HEIGHT = 44
  const bodyStyle: CSSProperties = { height: HEIGHT - HEADER_HEIGHT } // 44px header

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

  // Horizontal scrolling behaviour: map vertical wheel to horizontal when overflowing (same as BenchmarkProgress)
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      const { deltaX, deltaY } = e
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

  // Grid columns: Scenario | Score | Rank1..N
  const cols = useMemo(() => `minmax(220px,1fr) 90px ${Array.from({ length: ranks.length }).map(() => '120px').join(' ')}`, [ranks.length])

  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]" style={{ height: HEIGHT }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate">Benchmark progress for this scenario</div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Info"
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
            onClick={() => setShowInfo(v => !v)}
            title={showInfo ? 'Show details' : 'Show info'}
          >
            <Info size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden h-full" style={bodyStyle}>
        {showInfo ? (
          <div className="h-full overflow-y-auto text-sm text-[var(--text-primary)] px-3 pt-2">
            <div>
              <div className="mb-2">Shows your progress towards benchmark ranks for the currently selected scenario. This follows the benchmark you have open on the Benchmarks page.</div>
              <ul className="list-disc pl-5 text-[var(--text-secondary)]">
                <li>Open a benchmark in the Benchmarks tab to display its progress here.</li>
                <li>If this scenario isn’t part of the opened benchmark, an info message is shown.</li>
              </ul>
            </div>
          </div>
        ) : (
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
                  <div className="grid gap-1 w-full" style={{ gridTemplateColumns: cols }}>
                    <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Scenario</div>
                    <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">Score</div>
                    {ranks.map((r: { name: string; color: string }) => (
                      <div key={r.name} className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide text-center">{r.name}</div>
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
                            const border = r.color
                            const value = maxes?.[i + 1]
                            return (
                              <div key={r.name + i} className="text-[12px] text-center rounded px-2 py-1 relative overflow-hidden flex items-center justify-center" style={{ border: `1px solid ${border}` }}>
                                <div className="absolute inset-y-0 left-0" style={{ width: `${Math.round(fill * 100)}%`, background: hexToRgba(r.color, 0.35) }} />
                                <span className="relative z-10">{value != null ? numberFmt(value) : '—'}</span>
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
        )}
      </div>
    </div>
  )
}

export default ScenarioBenchmarkProgress

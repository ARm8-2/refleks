import { useEffect, useMemo, useState } from 'react'
import { Loading, Modal } from '../../../../shared/components'
import { getLastScenarioScores } from '../../../../shared/lib'
import type { KovaaksLastScore } from '../../../../shared/types'
import { formatNumber } from '../../lib/detailFormatting'

type Props = {
  isOpen: boolean
  onClose: () => void
  scenarioName: string
}

type Point = { x: number; y: number }

function buildSparklinePoints(scores: number[], width: number, height: number): Point[] {
  if (scores.length === 0) return []

  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const range = Math.max(1, max - min)
  const xStep = scores.length > 1 ? width / (scores.length - 1) : width

  return scores.map((score, index) => {
    const x = xStep * index
    const normalized = (score - min) / range
    const y = height - normalized * height
    return { x, y }
  })
}

export function ScenarioHistoryModal({ isOpen, onClose, scenarioName }: Props) {
  const [scores, setScores] = useState<KovaaksLastScore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !scenarioName) return

    setLoading(true)
    setError(null)
    setScores([])

    getLastScenarioScores(scenarioName)
      .then(result => setScores(result))
      .catch(fetchError => {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
      })
      .finally(() => setLoading(false))
  }, [isOpen, scenarioName])

  const sorted = useMemo(() => [...scores].reverse(), [scores])
  const numericScores = useMemo(() => sorted.map(score => Number(score.attributes?.score || 0)), [sorted])

  const points = useMemo(() => buildSparklinePoints(numericScores, 600, 180), [numericScores])

  const path = useMemo(() => {
    if (!points.length) return ''
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  }, [points])

  const high = numericScores.length ? Math.max(...numericScores) : 0
  const low = numericScores.length ? Math.min(...numericScores) : 0
  const latest = numericScores.length ? numericScores[numericScores.length - 1] : 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Last 10 Scores · ${scenarioName}`} width={900} height="auto">
      <div className="px-6 pb-6 space-y-4">
        {loading && <Loading />}

        {!loading && error && (
          <div className="rounded-xl border border-destructive-border bg-destructive-soft p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No scores found.</div>
        )}

        {!loading && !error && sorted.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">Latest</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(latest, 0)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">Highest</div>
                <div className="text-lg font-semibold text-success">{formatNumber(high, 0)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">Lowest</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(low, 0)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="h-[190px] w-full overflow-hidden rounded-xl bg-muted-strong px-2 py-2">
                <svg viewBox="0 0 600 180" className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Score trend">
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {path && (
                    <>
                      <path d={`${path} L 600 180 L 0 180 Z`} fill="url(#scoreFill)" />
                      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                </svg>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="max-h-[240px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">Date</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(item => {
                      const dateRaw = item.attributes?.challengeStart
                      const date = dateRaw ? new Date(dateRaw) : null
                      const dateLabel = date && !Number.isNaN(date.getTime())
                        ? date.toLocaleString()
                        : (dateRaw || 'Unknown')

                      return (
                        <tr key={item.id} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-2 text-foreground">{dateLabel}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">
                            {formatNumber(item.attributes?.score, 0)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

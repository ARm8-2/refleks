import { Loading, Modal } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { buildThresholdAnchoredScoreDomain, getLastScenarioScores } from '@/shared/lib'
import type { KovaaksLastScore, RankDef } from '@/shared/types'
import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../../lib/detailFormatting'

type Props = {
  isOpen: boolean
  onClose: () => void
  scenarioName: string
  thresholds: number[]
  rankDefs: RankDef[]
}

type TrendPoint = {
  run: number
  score: number
  dateLabel: string
}

type RankBand = {
  y1: number
  y2: number
  color: string
}

const chartConfig: ChartConfig = {
  score: { label: 'Score', color: 'var(--chart-2)' },
}

export function ScenarioHistoryModal({ isOpen, onClose, scenarioName, thresholds, rankDefs }: Props) {
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

  const trendData = useMemo<TrendPoint[]>(() => {
    return sorted.map((entry, index) => {
      const rawDate = entry.attributes?.challengeStart
      const date = rawDate ? new Date(rawDate) : null
      const dateLabel = date && !Number.isNaN(date.getTime())
        ? date.toLocaleString()
        : (rawDate || 'Unknown')

      return {
        run: index + 1,
        score: Number(entry.attributes?.score || 0),
        dateLabel,
      }
    })
  }, [sorted])

  const numericScores = useMemo(
    () => trendData.map(point => point.score).filter(score => Number.isFinite(score) && score > 0),
    [trendData],
  )

  const high = numericScores.length ? Math.max(...numericScores) : 0
  const low = numericScores.length ? Math.min(...numericScores) : 0
  const latest = numericScores.length ? numericScores[numericScores.length - 1] : 0

  const scoreDomain = useMemo(
    () => buildThresholdAnchoredScoreDomain(numericScores, thresholds),
    [numericScores, thresholds],
  )

  const rankBands = useMemo(() => {
    return buildRankBands(thresholds, rankDefs, scoreDomain)
  }, [rankDefs, scoreDomain, thresholds])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Scenario History · ${scenarioName}`} width={980} height="auto">
      <div className="space-y-3 px-4 pb-4">
        {loading && <Loading />}

        {!loading && error && (
          <div className="rounded-xl border border-destructive-border bg-destructive-soft p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && trendData.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No scores found.</div>
        )}

        {!loading && !error && trendData.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Latest</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(latest, 0)}</div>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Highest</div>
                <div className="text-lg font-semibold text-success">{formatNumber(high, 0)}</div>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Lowest</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(low, 0)}</div>
              </div>
            </div>

            <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
              <LineChart data={trendData} margin={{ top: 2, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="run" hide />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  width={46}
                  domain={scoreDomain}
                  tickFormatter={value => formatNumber(value, 0)}
                />

                {rankBands.map((band, index) => (
                  <ReferenceArea
                    key={`rank-band-${index}`}
                    y1={band.y1}
                    y2={band.y2}
                    fill={band.color}
                    fillOpacity={0.16}
                    strokeOpacity={0}
                    ifOverflow="extendDomain"
                  />
                ))}

                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel ?? null}
                    />
                  }
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-score)"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: 'var(--color-score)', strokeWidth: 0 }}
                  activeDot={{ r: 4.5 }}
                />
              </LineChart>
            </ChartContainer>
          </>
        )}
      </div>
    </Modal>
  )
}

function buildRankBands(thresholds: number[], rankDefs: RankDef[], domain: [number, number]): RankBand[] {
  const [domainMin, domainMax] = domain
  const stops = thresholds
    .filter(value => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)

  if (stops.length < 2 || rankDefs.length === 0 || domainMax <= domainMin) return []

  const bands: RankBand[] = []
  const maxIndex = Math.min(rankDefs.length, stops.length - 1)

  for (let index = 0; index < maxIndex; index += 1) {
    const rawStart = stops[index]
    const rawEnd = index === maxIndex - 1 ? domainMax : stops[index + 1]
    const y1 = Math.max(domainMin, rawStart)
    const y2 = Math.min(domainMax, rawEnd)
    if (y2 <= y1) continue

    bands.push({
      y1,
      y2,
      color: rankDefs[index]?.color || 'var(--chart-3)',
    })
  }

  return bands
}

import { Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { buildScoreDomain } from '@/shared/lib'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ScenarioTrendPoint } from '../lib/historyModels'
import { formatNumber } from '../lib/historyModels'

type Props = {
  scenarioName: string
  points: ScenarioTrendPoint[]
  onClickPoint: (runId: string) => void
  className?: string
}

const dualChartConfig: ChartConfig = {
  score: { label: 'Score', color: 'var(--chart-2)' },
  accuracy: { label: 'Accuracy %', color: 'var(--chart-4)' },
}

export function ScenarioTrendChart({ scenarioName, points, onClickPoint, className }: Props) {
  const hasAccuracy = points.some(point => point.accuracy != null && point.accuracy > 0)
  const scoreDomain = useMemo(() => buildScoreDomain(points.map(point => point.score)), [points])

  const handleChartClick = (state: { activeTooltipIndex?: number } | null) => {
    if (!state || state.activeTooltipIndex == null) return
    const point = points[state.activeTooltipIndex]
    if (point?.runId) onClickPoint(point.runId)
  }

  const chart = (expanded: boolean) => {
    const chartHeight = expanded ? 'h-[320px]' : 'h-[200px]'

    return (
      <ChartContainer config={dualChartConfig} className={`aspect-auto w-full ${chartHeight}`}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: 6, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
          <YAxis
            yAxisId="score"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            tickFormatter={value => formatNumber(value, 0)}
            domain={scoreDomain}
          />
          {hasAccuracy && (
            <YAxis
              yAxisId="accuracy"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={44}
              domain={[0, 100]}
              tickFormatter={value => `${value}%`}
            />
          )}
          <ChartTooltip
            content={(
              <ChartTooltipContent
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? null}
              />
            )}
          />
          <Line
            yAxisId="score"
            isAnimationActive={false}
            type="monotone"
            dataKey="score"
            stroke="var(--color-score)"
            strokeWidth={2.25}
            dot={{ r: expanded ? 2.75 : 2, fill: 'var(--color-score)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          {hasAccuracy && (
            <Line
              yAxisId="accuracy"
              isAnimationActive={false}
              type="monotone"
              dataKey="accuracy"
              stroke="var(--color-accuracy)"
              strokeWidth={1.75}
              strokeDasharray="4 3"
              dot={{ r: expanded ? 2 : 1.5, fill: 'var(--color-accuracy)', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ChartContainer>
    )
  }

  return (
    <Widget
      title={scenarioName}
      modalTitle={`${scenarioName} — Trend`}
      modalContent={chart(true)}
      className={className}
    >
      {chart(false)}
    </Widget>
  )
}
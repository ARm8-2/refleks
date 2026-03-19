import { formatNumber } from '@/features/benchmarks/lib/detailFormatting'
import { Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { TrendPoint, useCurrentScenarioHistory } from '../hooks/useCurrentScenarioHistory'

const sessionAverageChartConfig: ChartConfig = {
  score: {
    label: 'Average score',
    color: 'var(--chart-1)',
  },
}

const attemptChartConfig: ChartConfig = {
  score: {
    label: 'Score',
    color: 'var(--chart-2)',
  },
}

export function CurrentScenarioSessionAverageWidget() {
  const { currentScenarioName, sessionAveragePoints } = useCurrentScenarioHistory()

  return (
    <ScenarioTrendWidget
      title="Current Scenario Session Averages"
      description={currentScenarioName
        ? `${currentScenarioName} averaged by session.`
        : 'Average score of your latest played scenario by session.'}
      scenarioName={currentScenarioName}
      points={sessionAveragePoints}
      emptyMessage="Play the same scenario across multiple sessions to see the trend here."
      cadenceLabel="Sessions ordered oldest to latest."
      countLabel="Sessions"
      decimals={1}
      variant="area"
      chartConfig={sessionAverageChartConfig}
    />
  )
}

export function CurrentScenarioAttemptsWidget() {
  const { currentScenarioName, attemptPoints } = useCurrentScenarioHistory()

  return (
    <ScenarioTrendWidget
      title="Current Scenario Raw Scores"
      description={currentScenarioName
        ? `${currentScenarioName} score by individual run.`
        : 'Every recorded score for your latest played scenario.'}
      scenarioName={currentScenarioName}
      points={attemptPoints}
      emptyMessage="Play a scenario more than once to build out an attempt-by-attempt score history."
      cadenceLabel="Attempts ordered oldest to latest."
      countLabel="Attempts"
      decimals={0}
      variant="line"
      chartConfig={attemptChartConfig}
    />
  )
}

type ScenarioTrendWidgetProps = {
  title: string
  description: string
  scenarioName: string | null
  points: TrendPoint[]
  emptyMessage: string
  cadenceLabel: string
  countLabel: string
  decimals: number
  variant: 'area' | 'line'
  chartConfig: ChartConfig
}

function ScenarioTrendWidget({
  title,
  description,
  scenarioName,
  points,
  emptyMessage,
  cadenceLabel,
  countLabel,
  decimals,
  variant,
  chartConfig,
}: ScenarioTrendWidgetProps) {
  const chartId = useId().replace(/:/g, '')
  const gradientId = `${chartId}-fill`
  const latestScore = points.length > 0 ? points[points.length - 1].score : null
  const bestScore = points.length > 0 ? Math.max(...points.map(point => point.score)) : null
  const modalContent = points.length > 0 ? renderBody(true) : undefined

  return (
    <Widget title={title} description={description} modalTitle={title} modalContent={modalContent}>
      {renderBody(false)}
    </Widget>
  )

  function renderBody(expanded: boolean) {
    if (!scenarioName) {
      return <EmptyState message="No recent scenario found yet. Play something to populate this widget." />
    }

    if (points.length === 0) {
      return <EmptyState message={emptyMessage} />
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Latest" value={formatNumber(latestScore, decimals)} />
          <MetricCard label="Best" value={formatNumber(bestScore, decimals)} />
          <MetricCard label={countLabel} value={formatNumber(points.length, 0)} />
        </div>

        <div className="rounded-xl bg-secondary p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{scenarioName}</div>
              <div className="text-xs text-muted-foreground">{cadenceLabel}</div>
            </div>
          </div>

          <TrendChart
            chartConfig={chartConfig}
            points={points}
            variant={variant}
            decimals={decimals}
            expanded={expanded}
            gradientId={gradientId}
          />
        </div>
      </div>
    )
  }
}

type TrendChartProps = {
  chartConfig: ChartConfig
  points: TrendPoint[]
  variant: 'area' | 'line'
  decimals: number
  expanded: boolean
  gradientId: string
}

function TrendChart({ chartConfig, points, variant, decimals, expanded, gradientId }: TrendChartProps) {
  const chartHeight = expanded ? 'h-[360px]' : 'h-[240px]'

  if (variant === 'area') {
    return (
      <ChartContainer config={chartConfig} className={`aspect-auto w-full ${chartHeight}`}>
        <AreaChart data={points} margin={{ top: 12, right: 12, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-score)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-score)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            tickFormatter={value => formatNumber(value, decimals)}
          />
          <ChartTooltip content={<TooltipContent />} />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="score"
            stroke="var(--color-score)"
            fill={`url(#${gradientId})`}
            strokeWidth={2.5}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer config={chartConfig} className={`aspect-auto w-full ${chartHeight}`}>
      <LineChart data={points} margin={{ top: 12, right: 12, left: 6, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          tickFormatter={value => formatNumber(value, decimals)}
        />
        <ChartTooltip content={<TooltipContent />} />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="score"
          stroke="var(--color-score)"
          strokeWidth={2.25}
          dot={{ r: expanded ? 2.75 : 2, fill: 'var(--color-score)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

function TooltipContent() {
  return (
    <ChartTooltipContent
      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? null}
    />
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl bg-muted-strong p-4 text-sm text-muted-foreground">{message}</div>
}
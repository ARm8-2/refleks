import { formatNumber } from '@/features/benchmarks/lib/detailFormatting'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'
import { useStore } from '@/shared/hooks'
import { getScenarioName, readScenarioAccuracy, readScenarioScore, readScenarioTimestamp } from '@/shared/lib'
import type { ScenarioRecord, Session } from '@/shared/types'
import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, ReferenceArea, Scatter, XAxis, YAxis } from 'recharts'

type MetricKey = 'score' | 'accuracy' | 'ttk'

type SensitivityBin = {
  start: number
  end: number
  center: number
  count: number
}

type SensitivityPoint = {
  x: number
  performance: number
  rawSensitivity: number
  timestamp: number
  recency: number
  binIndex: number
  binStart: number
  binEnd: number
  binCount: number
  fullLabel: string
}

type PerformanceVsSensWidgetProps = {
  sessions?: Session[]
  scenarioName?: string | null
  title?: string
  description?: string
  className?: string
}

const metricOptions: Array<{ value: MetricKey; label: string }> = [
  { value: 'score', label: 'Score' },
  { value: 'accuracy', label: 'Accuracy (%)' },
  { value: 'ttk', label: 'Real Avg TTK (s)' },
]

const metricColors: Record<MetricKey, string> = {
  score: 'var(--chart-2)',
  accuracy: 'var(--chart-3)',
  ttk: 'var(--chart-4)',
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function PerformanceVsSensWidget({
  sessions,
  scenarioName,
  title = 'Performance vs Sensitivity',
  description,
  className,
}: PerformanceVsSensWidgetProps) {
  const storeSessions = useStore(state => state.sessions)
  const sourceSessions = sessions ?? storeSessions
  const [metric, setMetric] = useState<MetricKey>('score')

  const chartData = useMemo(
    () => buildChartData(sourceSessions, scenarioName ?? null, metric),
    [metric, scenarioName, sourceSessions],
  )
  const metricLabel = metricOptions.find(option => option.value === metric)?.label ?? 'Performance'
  const headerActions = (
    <Select value={metric} onValueChange={value => setMetric(value as MetricKey)}>
      <SelectTrigger className="h-7 w-auto min-w-0 max-w-[180px] px-2 text-xs bg-secondary">
        <SelectValue placeholder="Metric" />
      </SelectTrigger>
      <SelectContent>
        {metricOptions.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (!chartData.scenarioName) {
    return (
      <Widget
        title={title}
        description={description ?? 'Play a scenario to compare sensitivity against performance.'}
        headerActions={headerActions}
        className={className}
      >
        <EmptyState message="No recent scenario found yet. Play a run with cm/360 data to populate this widget." />
      </Widget>
    )
  }

  if (chartData.points.length === 0) {
    return (
      <Widget
        title={title}
        description={description ?? `${chartData.scenarioName} · ${metricLabel}`}
        headerActions={headerActions}
        className={className}
      >
        <EmptyState message={`No usable sensitivity data found for ${chartData.scenarioName}.`} />
      </Widget>
    )
  }

  const modalTitle = `${chartData.scenarioName} · ${title}`

  return (
    <Widget
      title={title}
      description={description ?? `${chartData.scenarioName} · ${chartData.points.length} runs · ${metricLabel}`}
      headerActions={headerActions}
      modalTitle={modalTitle}
      modalHeaderActions={headerActions}
      modalContent={<PerformanceVsSensChartContent data={chartData} metric={metric} metricLabel={metricLabel} expanded />}
      modalWidth={980}
      modalHeight={760}
      className={className}
    >
      <PerformanceVsSensChartContent data={chartData} metric={metric} metricLabel={metricLabel} />
    </Widget>
  )
}

function PerformanceVsSensChartContent({
  data,
  metric,
  metricLabel,
  expanded = false,
}: {
  data: ReturnType<typeof buildChartData>
  metric: MetricKey
  metricLabel: string
  expanded?: boolean
}) {
  const chartConfig: ChartConfig = {
    performance: {
      label: metricLabel,
      color: metricColors[metric],
    },
    count: {
      label: 'Run Count',
      color: 'var(--muted-foreground)',
    },
  }

  const chartHeight = expanded ? 'h-[420px]' : 'h-[270px]'
  const countMax = Math.max(1, Math.ceil(data.maxCount * 1.15))
  const yDomain = buildPerformanceDomain(data.points.map(point => point.performance))

  return (
    <div className={`w-full ${chartHeight}`}>
      <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
        <ComposedChart data={data.points} margin={{ top: 12, right: 12, left: 6, bottom: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[data.xMin, data.xMax]}
            tickFormatter={value => formatNumber(value, 1)}
          />
          <YAxis
            yAxisId="performance"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            domain={yDomain}
            tickFormatter={value => formatMetricTick(value, metric)}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
            allowDecimals={false}
            domain={[0, countMax]}
            tickFormatter={value => formatNumber(value, 0)}
          />

          {data.bins.map(bin => (
            <ReferenceArea
              key={`${bin.start}-${bin.end}`}
              x1={bin.start}
              x2={bin.end}
              y1={0}
              y2={bin.count}
              yAxisId="count"
              fill="var(--chart-1)"
              fillOpacity={0.08}
              stroke="var(--border)"
              strokeOpacity={0.28}
              ifOverflow="extendDomain"
            />
          ))}

          <ChartTooltip content={<PerformanceVsSensTooltip metric={metric} metricLabel={metricLabel} />} />

          <Scatter
            yAxisId="performance"
            name="performance"
            data={data.points}
            dataKey="performance"
            fill="var(--color-performance)"
            stroke="var(--color-performance)"
            isAnimationActive={false}
            r={3.2}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

function PerformanceVsSensTooltip({
  active,
  payload,
  metric,
  metricLabel,
}: {
  active?: boolean
  payload?: Array<{ payload?: SensitivityPoint }>
  metric: MetricKey
  metricLabel: string
}) {
  if (!active || !payload?.length) return null

  const point = payload
    .map(entry => entry.payload)
    .find((candidate): candidate is SensitivityPoint => Boolean(candidate && typeof candidate === 'object' && 'rawSensitivity' in candidate))

  if (!point) return null

  return (
    <div className="grid min-w-[14rem] gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">{point.fullLabel}</div>
      <div className="grid gap-0.5 text-muted-foreground">
        <div>Sensitivity: {formatNumber(point.rawSensitivity, 2)} cm/360</div>
        <div>{metricLabel}: {formatMetricValue(point.performance, metric)}</div>
        <div>Bin: {formatNumber(point.binStart, 2)} - {formatNumber(point.binEnd, 2)} cm/360 · {formatNumber(point.binCount, 0)} runs</div>
      </div>
    </div>
  )
}

function buildChartData(sessions: Session[], scenarioName: string | null, metric: MetricKey) {
  let resolvedScenarioName = scenarioName?.trim() || null

  if (!resolvedScenarioName) {
    for (const session of sessions) {
      for (const item of session.items) {
        const name = getScenarioName(item).trim()
        if (!name) continue
        resolvedScenarioName = name
        break
      }

      if (resolvedScenarioName) break
    }
  }

  if (!resolvedScenarioName) {
    return {
      scenarioName: null as string | null,
      points: [] as SensitivityPoint[],
      bins: [] as SensitivityBin[],
      xMin: 0,
      xMax: 0,
      maxCount: 0,
    }
  }

  const rawPoints: Array<{ x: number; performance: number; rawSensitivity: number; timestamp: number; recency: number }> = []
  let recency = 0

  for (const session of sessions) {
    for (const item of session.items) {
      if (getScenarioName(item).trim() !== resolvedScenarioName) continue

      const rawSensitivity = Number(item.stats?.['cm/360'] ?? 0)
      if (!Number.isFinite(rawSensitivity) || rawSensitivity <= 0) continue

      const performance = readMetricValue(item, metric)
      if (performance === null) continue

      rawPoints.push({
        x: rawSensitivity,
        performance,
        rawSensitivity,
        timestamp: readTimestamp(item),
        recency: recency++,
      })
    }
  }

  if (rawPoints.length === 0) {
    return {
      scenarioName: resolvedScenarioName,
      points: [] as SensitivityPoint[],
      bins: [] as SensitivityBin[],
      xMin: 0,
      xMax: 0,
      maxCount: 0,
    }
  }

  const sortedBySensitivity = [...rawPoints].sort((left, right) => left.x - right.x || left.recency - right.recency)
  const xs = sortedBySensitivity.map(point => point.x)
  let xMin = Math.min(...xs)
  let xMax = Math.max(...xs)

  if (xMin === xMax) {
    const pad = Math.max(0.5, Math.abs(xMin) * 0.05)
    xMin -= pad
    xMax += pad
  }

  const q1 = percentile(xs, 0.25)
  const q3 = percentile(xs, 0.75)
  const iqr = q3 - q1
  const fdWidth = iqr > 0 ? (2 * iqr) / Math.cbrt(rawPoints.length) : 0
  let binWidth = Number.isFinite(fdWidth) && fdWidth > 0 ? fdWidth : (xMax - xMin) / Math.max(3, Math.round(Math.sqrt(rawPoints.length)))

  if (!Number.isFinite(binWidth) || binWidth <= 0) {
    binWidth = (xMax - xMin) / Math.max(1, Math.round(Math.sqrt(rawPoints.length)))
  }

  let binCount = Math.max(1, Math.ceil((xMax - xMin) / binWidth))
  binCount = Math.max(1, Math.min(50, binCount))
  binWidth = (xMax - xMin) / binCount

  const bins: SensitivityBin[] = []
  for (let index = 0; index < binCount; index++) {
    const start = xMin + index * binWidth
    const end = start + binWidth
    bins.push({ start, end, center: (start + end) / 2, count: 0 })
  }

  const assignments = rawPoints.map(point => {
    let binIndex = Math.floor((point.x - xMin) / binWidth)
    if (binIndex < 0) binIndex = 0
    if (binIndex >= bins.length) binIndex = bins.length - 1

    bins[binIndex].count += 1
    return { point, binIndex }
  })

  const points: SensitivityPoint[] = assignments.map(({ point, binIndex }) => ({
    x: bins[binIndex].center,
    performance: point.performance,
    rawSensitivity: point.rawSensitivity,
    timestamp: point.timestamp,
    recency: point.recency,
    binIndex,
    binStart: bins[binIndex].start,
    binEnd: bins[binIndex].end,
    binCount: bins[binIndex].count,
    fullLabel: formatRunLabel(point.timestamp, point.recency + 1),
  }))

  return {
    scenarioName: resolvedScenarioName,
    points,
    bins,
    xMin,
    xMax,
    maxCount: Math.max(...bins.map(bin => bin.count)),
  }
}

function readMetricValue(item: ScenarioRecord, metric: MetricKey): number | null {
  if (metric === 'score') {
    return readScenarioScore(item)
  }

  if (metric === 'accuracy') {
    const accuracy = readScenarioAccuracy(item)
    return accuracy !== null && Number.isFinite(accuracy) ? accuracy : null
  }

  const ttk = Number(item.stats?.['Real Avg TTK'] ?? NaN)
  return Number.isFinite(ttk) ? ttk : null
}

function readTimestamp(item: ScenarioRecord): number {
  return readScenarioTimestamp(item)
}

function buildPerformanceDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05)
    return [min - pad, max + pad]
  }

  const span = max - min
  const pad = Math.max(span * 0.12, 1)
  return [min - pad, max + pad]
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * p
  const base = Math.floor(position)
  const rest = position - base

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }

  return sorted[base]
}

function formatRunLabel(timestamp: number, runIndex: number): string {
  if (timestamp <= 0) return `Run ${runIndex}`
  return `Run ${runIndex} · ${dateTimeFormatter.format(new Date(timestamp))}`
}

function formatMetricTick(value: number, metric: MetricKey): string {
  return formatMetricValue(value, metric)
}

function formatMetricValue(value: number, metric: MetricKey): string {
  if (metric === 'accuracy') return `${formatNumber(value, 1)}%`
  if (metric === 'ttk') return `${formatNumber(value, 3)}s`
  return formatNumber(value, 0)
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl bg-muted-strong p-4 text-sm text-muted-foreground">{message}</div>
}
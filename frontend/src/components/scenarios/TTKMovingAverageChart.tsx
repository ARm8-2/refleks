import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ChartBox } from '..'
import { useChartTheme } from '../../hooks/useChartTheme'
import { CHART_DECIMALS, extractChartValue, formatNumber, formatSeconds, MISSING_STR } from '../../lib/utils'
import { TTKMovingAverageDetails } from './TTKMovingAverageDetails'

type TTKMovingAverageChartProps = {
  labels: string[]
  realTTK: number[]
  ma5: number[]
  movingAvg: {
    slope: number
    intercept?: number
    r2: number
    ma5NetChange?: number
    meanMA5?: number
    stdMA5?: number
    meanRollStd5?: number
    stableSegments: Array<{ start: number; end: number }>
  }
}

export function TTKMovingAverageChart({ labels, realTTK, ma5, movingAvg }: TTKMovingAverageChartProps) {
  const colors = useChartTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const trend = useMemo(() => ma5.map((_, i) => (movingAvg.intercept ?? 0) + movingAvg.slope * i), [ma5, movingAvg])
  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'TTK (s)',
        data: realTTK,
        borderColor: 'rgb(239,68,68)',
        backgroundColor: 'rgba(239,68,68,0.2)',
        yAxisID: 'y',
        tension: 0.15,
        pointRadius: 0,
      },
      {
        label: 'MA(5) TTK',
        data: ma5,
        borderColor: 'rgb(59,130,246)',
        backgroundColor: 'rgba(59,130,246,0.2)',
        yAxisID: 'y',
        tension: 0.15,
        pointRadius: 0,
      },
      {
        label: 'MA(5) Trend',
        data: trend,
        borderColor: 'rgb(156,163,175)',
        backgroundColor: 'rgba(156,163,175,0.0)',
        yAxisID: 'y',
        tension: 0,
        pointRadius: 0,
        borderDash: [6, 6],
      },
    ],
  }), [labels, realTTK, ma5, trend])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: true, labels: { color: colors.textPrimary } },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const dsLabel = ctx.dataset && ctx.dataset.label ? ctx.dataset.label : ''
            const n = extractChartValue(ctx)
            if (typeof dsLabel === 'string' && dsLabel.includes('TTK')) {
              return `${dsLabel}: ${formatSeconds(n, CHART_DECIMALS.ttkTooltip)}`
            }
            return `${dsLabel}: ${n !== undefined && Number.isFinite(n) ? formatNumber(n, CHART_DECIMALS.numTooltip) : MISSING_STR}`
          }
        },
      },
    },
    scales: {
      x: {
        ticks: { color: colors.textSecondary },
        grid: { color: colors.grid },
        title: { display: isExpanded, text: 'Kills (Sequence)', color: colors.textSecondary }
      },
      y: {
        ticks: { color: colors.textSecondary, callback: (v: any) => formatSeconds(v, CHART_DECIMALS.ttkTick) },
        grid: { color: colors.grid },
        suggestedMin: 0,
        title: { display: isExpanded, text: 'Time To Kill (s)', color: colors.textSecondary }
      },
    },
  }), [colors, isExpanded])

  return (
    <div>
      <ChartBox
        title="TTK with Moving Average (5) & Trend"
        expandable={true}
        isExpanded={isExpanded}
        onExpandChange={setIsExpanded}
        info={<div className="text-sm">
          <div className="mb-2">Shows raw TTK per kill, a trailing 5-sample moving average (MA(5)), and a dotted linear trend line of the moving average.</div>
          <div className="mb-2 font-medium">How to interpret</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>MA(5) smooths short-term noise; use it to track persistent changes rather than per-kill variability.</li>
            <li>A downward slope in the trend signifies faster average TTK over time (improvement).</li>
            <li>Stable segments (low rolling std) indicate periods of consistent play - use them as baselines.</li>
            <li>Short spikes in raw TTK often reflect pauses or outliers; rely on MA(5) and trend for long-term signals.</li>
          </ul>
        </div>}
        height={320}
      >
        <div className="h-full">
          <Line data={data as any} options={options as any} />
        </div>
      </ChartBox>
      <TTKMovingAverageDetails movingAvg={movingAvg} />
    </div>
  )
}

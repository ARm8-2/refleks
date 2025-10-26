import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { ChartBox } from '..'
import { TTKMovingAverageDetails } from './TTKMovingAverageDetails'

export function TTKMovingAverageChart({ labels, realTTK, ma5, colors, movingAvg }: {
  labels: string[]
  realTTK: number[]
  ma5: number[]
  colors: any
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
}) {
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
    plugins: {
      legend: { display: true, labels: { color: colors.textPrimary } },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: { ticks: { color: colors.textSecondary }, grid: { color: colors.grid } },
      y: { ticks: { color: colors.textSecondary }, grid: { color: colors.grid }, suggestedMin: 0 },
    },
  }), [colors])

  return (
    <div>
      <ChartBox
        title="TTK with Moving Average (5) & Trend"
        info={<div className="text-sm">
          <div className="mb-2">Shows raw TTK per kill, a trailing 5-sample moving average, and a dotted linear trend line of the moving average.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>MA(5) = average of the last 5 TTK values.</li>
            <li>The dotted line is a linear fit over MA(5) to visualize trend.</li>
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

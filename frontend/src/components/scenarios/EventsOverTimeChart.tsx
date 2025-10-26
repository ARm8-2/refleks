import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { ChartBox } from '..'
import { EventsOverTimeDetails } from './EventsOverTimeDetails'

export function EventsOverTimeChart({
  timeSec,
  accOverTime,
  realTTK,
  cumKills,
  colors,
  summary,
}: {
  timeSec: number[]
  accOverTime: number[]
  realTTK: number[]
  cumKills: number[]
  colors: any
  summary: {
    kills: number
    shots: number
    hits: number
    finalAcc: number
    longestGap: number
    avgGap: number
    avgTTK: number
    medianTTK: number
    stdTTK: number
    p10TTK?: number
    p90TTK?: number
    meanKPM?: number
  }
}) {
  const data = useMemo(() => {
    const acc = timeSec.map((x, i) => ({ x, y: accOverTime[i] }))
    const ttk = timeSec.map((x, i) => ({ x, y: realTTK[i] }))
    const kills = timeSec.map((x, i) => ({ x, y: cumKills[i] }))
    return ({
      datasets: [
        {
          label: 'Cumulative Accuracy',
          data: acc,
          yAxisID: 'y1',
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.25)',
          tension: 0.25,
          pointRadius: 0,
        },
        {
          label: 'Real TTK (s)',
          data: ttk,
          yAxisID: 'y2',
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.25)',
          tension: 0.25,
          pointRadius: 0,
        },
        {
          label: 'Cumulative Kills',
          data: kills,
          yAxisID: 'y3',
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0,
          pointRadius: 0,
          stepped: 'before' as const,
        },
      ],
    })
  }, [timeSec, accOverTime, realTTK, cumKills])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: colors.textPrimary } },
      tooltip: {
        intersect: false,
        mode: 'index' as const,
        backgroundColor: colors.tooltipBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: (items: any[]) => {
            if (!items || !items.length) return ''
            const x = items[0].raw?.x
            if (!Number.isFinite(x)) return ''
            const m = Math.floor(x / 60)
            const s = (x - m * 60).toFixed(2).padStart(5, '0')
            return `${m}:${s}`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        ticks: {
          color: colors.textSecondary, callback: (v: any) => {
            const x = Number(v)
            const m = Math.floor(x / 60)
            const s = (x - m * 60).toFixed(0).padStart(2, '0')
            return `${m}:${s}`
          }
        },
        grid: { color: colors.grid },
      },
      y1: {
        type: 'linear' as const,
        position: 'left' as const,
        suggestedMin: 0,
        suggestedMax: 1,
        ticks: {
          color: colors.textSecondary,
          callback: (v: any) => `${(Number(v) * 100).toFixed(0)}%`,
        },
        grid: { color: colors.grid },
      },
      y2: {
        type: 'linear' as const,
        position: 'right' as const,
        suggestedMin: 0,
        ticks: { color: colors.textSecondary },
        grid: { drawOnChartArea: false },
      },
      y3: {
        type: 'linear' as const,
        position: 'right' as const,
        offset: true,
        suggestedMin: 0,
        ticks: {
          color: colors.textSecondary,
          callback: (v: any) => `${Number(v).toFixed(0)}`,
          precision: 0,
        },
        grid: { drawOnChartArea: false },
      },
    },
  }), [colors])

  return (
    <div>
      <ChartBox
        title="Kills Over Time"
        info={<div>
          <div className="mb-2">This chart plots cumulative accuracy (left), real TTK between kills (right), and cumulative kills (stepped, secondary right) over the scenario timeline. The X‑axis is elapsed time from the scenario start.</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Time origin is the scenario’s “Challenge Start”.</li>
            <li>Real TTK = elapsed time between consecutive kills (first kill from start).</li>
            <li>Cumulative accuracy = cumulative Hits / Shots.</li>
          </ul>
        </div>}
        height={320}
      >
        <div className="h-full">
          <Line data={data as any} options={options as any} />
        </div>
      </ChartBox>
      <EventsOverTimeDetails summary={summary} />
    </div>
  )
}

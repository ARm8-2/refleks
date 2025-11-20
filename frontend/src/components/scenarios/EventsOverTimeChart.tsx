import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ChartBox } from '..'
import { useChartTheme } from '../../hooks/useChartTheme'
import { CHART_DECIMALS, extractChartValue, formatMmSs, formatNumber, formatPct, formatSeconds, formatUiValueForLabel } from '../../lib/utils'
import { EventsOverTimeDetails } from './EventsOverTimeDetails'

type EventsOverTimeChartProps = {
  timeSec: number[]
  accOverTime: number[]
  realTTK: number[]
  cumKills: number[]
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
}

export function EventsOverTimeChart({
  timeSec,
  accOverTime,
  realTTK,
  cumKills,
  summary,
}: EventsOverTimeChartProps) {
  const colors = useChartTheme()
  const [isExpanded, setIsExpanded] = useState(false)
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
          hidden: true
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
            return formatMmSs(x, CHART_DECIMALS.timeTooltip)
          },
          label: (ctx: any) => {
            const dsLabel = ctx.dataset && ctx.dataset.label ? ctx.dataset.label : ''
            const n = extractChartValue(ctx)
            if (typeof dsLabel === 'string' && (dsLabel.includes('Accuracy') || dsLabel.includes('Acc'))) {
              return `${dsLabel}: ${formatUiValueForLabel(n, dsLabel, CHART_DECIMALS.pctTooltip)}`
            }
            if (typeof dsLabel === 'string' && dsLabel.includes('TTK')) {
              return `${dsLabel}: ${formatUiValueForLabel(n, dsLabel, CHART_DECIMALS.ttkTooltip)}`
            }
            // Default: integer for kills else 1 decimal for other numbers
            if (ctx.dataset && ctx.dataset.yAxisID === 'y3') return `${dsLabel}: ${formatNumber(n, CHART_DECIMALS.numTooltip)}`
            return `${dsLabel}: ${formatUiValueForLabel(n, dsLabel, CHART_DECIMALS.numTooltip)}`
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
            return formatMmSs(x, CHART_DECIMALS.timeTick)
          }
        },
        grid: { color: colors.grid },
        title: { display: isExpanded, text: 'Time (mm:ss)', color: colors.textSecondary }
      },
      y1: {
        type: 'linear' as const,
        position: 'left' as const,
        suggestedMin: 0,
        suggestedMax: 1,
        ticks: {
          color: colors.textSecondary,
          callback: (v: any) => formatPct(v, CHART_DECIMALS.pctTick),
        },
        grid: { color: colors.grid },
        title: { display: isExpanded, text: 'Accuracy (%)', color: colors.textSecondary }
      },
      y2: {
        type: 'linear' as const,
        position: 'right' as const,
        suggestedMin: 0,
        ticks: { color: colors.textSecondary, callback: (v: any) => formatSeconds(v, CHART_DECIMALS.ttkTick) },
        grid: { drawOnChartArea: false },
        title: { display: isExpanded, text: 'Real TTK (s)', color: colors.textSecondary }
      },
      y3: {
        type: 'linear' as const,
        position: 'right' as const,
        offset: true,
        suggestedMin: 0,
        ticks: {
          color: colors.textSecondary,
          callback: (v: any) => `${formatNumber(v, CHART_DECIMALS.numTick)}`,
          precision: 0,
        },
        grid: { drawOnChartArea: false },
        title: { display: isExpanded, text: 'Cumulative Kills', color: colors.textSecondary }
      },
    },
  }), [colors, isExpanded])

  return (
    <div>
      <ChartBox
        title="Kills Over Time"
        expandable={true}
        isExpanded={isExpanded}
        onExpandChange={setIsExpanded}
        info={<div>
          <div className="mb-2">This chart plots cumulative accuracy (left), real TTK between kills (right), and cumulative kills (stepped, secondary right) over the scenario timeline. The X‑axis is elapsed time from the scenario start. Hover points for exact values at a moment in time.</div>
          <div className="mb-2 font-medium">How to interpret</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Cumulative Accuracy shows how your accuracy evolves across a run. A rising curve indicates improvement; a flat line indicates stable accuracy.</li>
            <li>Real TTK (s) shows the time between consecutive kills. Lower TTK indicates faster play; watch for large TTK spikes that indicate downtime or pauses.</li>
            <li>Cumulative Kills indicates pacing - a steep slope means dense kill events. Combine with TTK to assess intensity versus steadiness.</li>
            <li>Use the tooltips to inspect the exact values at particular times and compare across the traces.</li>
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

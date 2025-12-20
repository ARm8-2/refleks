import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import { usePageState } from '../../hooks/usePageState'
import { CHART_DECIMALS } from '../../lib/constants'
import { extractChartValue, formatMmSs, formatNumber, formatPct, formatSeconds, formatUiValueForLabel } from '../../lib/utils'
import { ChartBox } from '../shared/ChartBox'

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
  const [isExpanded, setIsExpanded] = usePageState('analysis:events-over-time:expanded', false)
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
          borderColor: colors.accent,
          backgroundColor: colors.accentSoft,
          tension: 0.25,
          pointRadius: 0,
        },
        {
          label: 'Real TTK (s)',
          data: ttk,
          yAxisID: 'y2',
          borderColor: colors.danger,
          backgroundColor: colors.dangerSoft,
          tension: 0.25,
          pointRadius: 0,
          hidden: true
        },
        {
          label: 'Cumulative Kills',
          data: kills,
          yAxisID: 'y3',
          borderColor: colors.success,
          backgroundColor: colors.successSoft,
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

  const infoContent = (
    <div>
      <div className="mb-2">Shows cumulative accuracy, kills, and real TTK over the duration of the run.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>X-axis is time in minutes:seconds.</li>
        <li>Cumulative Accuracy (blue) shows how your accuracy evolved throughout the run.</li>
        <li>Cumulative Kills (green) shows the pace of kills.</li>
        <li>Real TTK (red, hidden by default) shows the time-to-kill for each individual kill event. Click the legend to toggle it.</li>
      </ul>
    </div>
  )

  return (
    <ChartBox
      title="Events over time"
      expandable={true}
      isExpanded={isExpanded}
      onExpandChange={setIsExpanded}
      info={infoContent}
      height={320}
    >
      <div className="h-full">
        <Line data={data as any} options={options as any} />
      </div>
    </ChartBox>
  )
}

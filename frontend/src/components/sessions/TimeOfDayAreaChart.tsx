import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import { CHART_DECIMALS } from '../../lib/constants'
import { formatNumber } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'
import { ChartBox } from '../shared/ChartBox'

type TimeOfDayAreaChartProps = {
  items: ScenarioRecord[]
}

export function TimeOfDayAreaChart({ items }: TimeOfDayAreaChartProps) {
  const theme = useChartTheme()
  const [isExpanded, setIsExpanded] = useState(false)

  const counts = useMemo(() => {
    const arr = Array.from({ length: 24 }, () => 0)
    for (const it of items) {
      const t = String(it.stats['Challenge Start'] ?? '')
      if (!t) continue
      const hh = parseInt(t.split(':')[0], 10)
      if (Number.isFinite(hh) && hh >= 0 && hh < 24) arr[hh]++
    }
    return arr
  }, [items])

  const labels = useMemo(() => Array.from({ length: 24 }, (_, h) => h.toString().padStart(2, '0')), [])

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Runs per hour',
        data: counts,
        borderColor: theme.accent,
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return theme.accentSoft
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, theme.accent)
          g.addColorStop(1, theme.accentSoft)
          return g
        },
        fill: 'start',
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }), [labels, counts, theme])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: (items: any[]) => (items?.[0]?.label ? `${items[0].label}:00` : ''),
          label: (ctx: any) => {
            const v = ctx.parsed?.y
            return `${formatNumber(v ?? 0, CHART_DECIMALS.numTick)} run${v === 1 ? '' : 's'}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: theme.grid },
        ticks: { color: theme.textSecondary },
        title: { display: isExpanded, text: 'Hour of Day', color: theme.textSecondary }
      },
      y: {
        grid: { color: theme.grid },
        ticks: { color: theme.textSecondary, precision: 0 },
        beginAtZero: true,
        suggestedMin: 0,
        title: { display: isExpanded, text: 'Runs', color: theme.textSecondary }
      },
    },
  }), [theme, isExpanded])

  const infoContent = (
    <div>
      <div className="mb-2">Shows the distribution of your runs across the 24-hour day.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Peaks indicate your most active playing times.</li>
        <li>Useful for identifying when you perform best or play most often.</li>
      </ul>
    </div>
  )

  return (
    <ChartBox
      title="Time of Day (Runs)"
      expandable={true}
      isExpanded={isExpanded}
      onExpandChange={setIsExpanded}
      info={infoContent}
      height={300}
    >
      <div className="h-full">
        <Line options={options} data={data} />
      </div>
    </ChartBox>
  )
}

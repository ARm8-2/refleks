import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import type { ScenarioRecord } from '../../types/ipc'

type TimeOfDayAreaChartProps = { items: ScenarioRecord[] }

export function TimeOfDayAreaChart({ items }: TimeOfDayAreaChartProps) {
  const theme = useChartTheme()

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
        borderColor: 'rgb(99,102,241)',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'rgba(99,102,241,0.25)'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(99,102,241,0.45)')
          g.addColorStop(1, 'rgba(99,102,241,0.00)')
          return g
        },
        fill: 'start',
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }), [labels, counts])

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
            return `${v ?? 0} run${v === 1 ? '' : 's'}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: theme.grid },
        ticks: { color: theme.textSecondary },
        title: { display: true, text: 'Hour of day (local)', color: theme.textSecondary },
      },
      y: {
        grid: { color: theme.grid },
        ticks: { color: theme.textSecondary, precision: 0 },
        beginAtZero: true,
        suggestedMin: 0,
      },
    },
  }), [theme])

  return <Line data={data as any} options={options as any} />
}

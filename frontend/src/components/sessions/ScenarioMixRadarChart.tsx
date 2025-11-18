import { useMemo } from 'react';
import { Radar } from 'react-chartjs-2';
import { useChartTheme } from '../../hooks/useChartTheme';
import { CHART_DECIMALS, formatNumber } from '../../lib/utils';

type ScenarioMixRadarChartProps = { labels: string[]; counts: number[] }

export function ScenarioMixRadarChart({ labels, counts }: ScenarioMixRadarChartProps) {
  const { textSecondary, grid } = useChartTheme()
  const stroke = 'rgb(34, 197, 94)'
  const fill = 'rgba(34, 197, 94, 0.25)'

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Scenarios played',
        data: counts,
        borderColor: stroke,
        backgroundColor: fill,
        pointBackgroundColor: stroke,
        pointBorderColor: stroke,
        pointRadius: 3,
        borderWidth: 2,
      },
    ],
  }), [labels, counts])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${formatNumber(ctx.parsed ?? ctx.raw ?? ctx.raw?.y ?? 0, CHART_DECIMALS.numTooltip)}` } } },
    scales: {
      r: {
        beginAtZero: true,
        grid: { color: grid },
        angleLines: { color: grid },
        pointLabels: { color: textSecondary, font: { size: 11 } },
        ticks: {
          color: textSecondary,
          showLabelBackdrop: false,
          backdropColor: 'transparent',
          z: 1,
          precision: 0,
        },
      },
    },
  }), [textSecondary, grid])

  return <Radar data={data as any} options={options as any} />
}

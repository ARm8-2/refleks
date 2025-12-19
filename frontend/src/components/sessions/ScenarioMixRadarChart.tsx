import { useMemo } from 'react';
import { Radar } from 'react-chartjs-2';
import { useChartTheme } from '../../hooks/useChartTheme';
import { CHART_DECIMALS } from '../../lib/constants';
import { formatNumber } from '../../lib/utils';

type ScenarioMixRadarChartProps = { labels: string[]; counts: number[] }

export function ScenarioMixRadarChart({ labels, counts }: ScenarioMixRadarChartProps) {
  const { textSecondary, grid, success, successSoft } = useChartTheme()

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Scenarios played',
        data: counts,
        borderColor: success,
        backgroundColor: successSoft,
        pointBackgroundColor: success,
        pointBorderColor: success,
        pointRadius: 3,
        borderWidth: 2,
      },
    ],
  }), [labels, counts, success, successSoft])

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

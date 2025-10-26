import { useMemo } from 'react';
import { Radar } from 'react-chartjs-2';

export function ScenarioMixRadarChart({ labels, counts }: { labels: string[]; counts: number[] }) {
  const css = getComputedStyle(document.documentElement)
  const textColor = css.getPropertyValue('--text-primary').trim() || '#e6e6e6'
  const gridColor = 'rgba(255,255,255,0.06)'
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
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true,
        grid: { color: gridColor },
        angleLines: { color: gridColor },
        pointLabels: { color: textColor, font: { size: 11 } },
        ticks: {
          color: textColor,
          showLabelBackdrop: false,
          backdropColor: 'transparent',
          z: 1,
          precision: 0,
        },
      },
    },
  }), [textColor])

  return <Radar data={data as any} options={options as any} />
}

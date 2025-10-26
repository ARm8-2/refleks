import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

export function MetricsLineChart({ labels, score, acc, ttk }: { labels: string[]; score: number[]; acc: number[]; ttk: number[] }) {
  const css = getComputedStyle(document.documentElement)
  const textColor = css.getPropertyValue('--text-primary').trim() || '#e6e6e6'
  const gridColor = 'rgba(255,255,255,0.06)'

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Score',
        data: score,
        yAxisID: 'yScore',
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        tension: 0.25,
        pointRadius: 2,
      },
      {
        label: 'Accuracy (%)',
        data: acc,
        yAxisID: 'yAcc',
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
        tension: 0.25,
        pointRadius: 2,
      },
      {
        label: 'Real Avg TTK (s)',
        data: ttk,
        yAxisID: 'yTTK',
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
        tension: 0.25,
        pointRadius: 2,
      },
    ]
  }), [labels, score, acc, ttk])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' as const, labels: { color: textColor } },
      tooltip: { intersect: false, mode: 'index' as const },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor } },
      yScore: { type: 'linear' as const, position: 'left' as const, grid: { color: gridColor }, ticks: { color: textColor } },
      yAcc: { type: 'linear' as const, position: 'right' as const, grid: { drawOnChartArea: false }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
      yTTK: { type: 'linear' as const, position: 'right' as const, grid: { drawOnChartArea: false }, ticks: { color: textColor } },
    },
  }), [textColor])

  return <Line data={data as any} options={options as any} />
}

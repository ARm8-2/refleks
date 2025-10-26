import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import { ChartBox } from '..';
import { AccuracyVsSpeedDetails } from './AccuracyVsSpeedDetails';

export function AccuracyVsSpeedChart({ points, colors, scatter }: {
  points: Array<{ x: number; y: number; i: number }>; colors: any; scatter: {
    corrKpmAcc: number
    meanBinStdAcc: number
    binsUsed: number
    medianNNDist: number
    centroidKPM?: number
    centroidAcc?: number
    clusterCompactness?: number
  }
}) {
  const data = useMemo(() => ({
    datasets: [
      {
        label: 'Accuracy vs Speed (KPM)',
        data: points,
        parsing: false,
        showLine: false,
        borderColor: 'rgb(99,102,241)',
        backgroundColor: 'rgba(99,102,241,0.4)',
        pointRadius: 3,
        pointHoverRadius: 4,
      },
    ],
  }), [points])

  const maxX = useMemo(() => points.reduce((m, p) => Math.max(m, p.x), 0), [points])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: () => 'Kill',
          label: (ctx: any) => {
            const p = ctx.raw as { x: number; y: number; i: number }
            return [`#${(p.i + 1)}`, `KPM: ${p.x.toFixed(1)}`, `Acc: ${(p.y * 100).toFixed(1)}%`]
          },
        }
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Kills per minute (KPM)', color: colors.textSecondary },
        ticks: { color: colors.textSecondary },
        grid: { color: colors.grid },
        suggestedMin: 0,
        suggestedMax: Math.max(60, Math.ceil(maxX / 10) * 10),
      },
      y: {
        suggestedMin: 0,
        suggestedMax: 1,
        ticks: { color: colors.textSecondary, callback: (v: any) => `${(Number(v) * 100).toFixed(0)}%` },
        grid: { color: colors.grid },
      },
    },
  }), [colors, maxX])

  return (
    <div>
      <ChartBox
        title="Accuracy vs Speed (per kill)"
        info={<div className="text-sm">
          <div className="mb-2">Each point is a kill: X is speed (kills per minute), Y is per-kill accuracy (hits/shots).</div>
          <ul className="list-disc pl-5 text-[var(--text-secondary)]">
            <li>Speed is derived from the real TTK between kills.</li>
            <li>Very short TTK values are clamped to avoid infinite speeds.</li>
          </ul>
        </div>}
        height={320}
      >
        <div className="h-full">
          <Scatter data={data as any} options={options as any} />
        </div>
      </ChartBox>
      <AccuracyVsSpeedDetails scatter={scatter} />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ChartBox } from '..'
import { useChartTheme } from '../../hooks/useChartTheme'
import { Metric, collectRunsBySession, expectedBestVsLength, expectedByIndex, recommendLengths } from '../../lib/analysis/sessionLength'
import type { Session } from '../../types/domain'

export function SessionLengthInsights({ sessions, scenarioName }: { sessions: Session[]; scenarioName: string }) {
  const theme = useChartTheme()
  const [metric, setMetric] = useState<Metric>('score')

  const runs = useMemo(() => collectRunsBySession(sessions, scenarioName), [sessions, scenarioName])
  const byIdx = useMemo(() => expectedByIndex(runs, metric), [runs, metric])
  const bestVsL = useMemo(() => expectedBestVsLength(runs, metric), [runs, metric])
  const rec = useMemo(() => recommendLengths(byIdx, bestVsL), [byIdx, bestVsL])

  const idxData = useMemo(() => ({
    labels: byIdx.mean.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: metric === 'score' ? 'Expected Score' : 'Expected Accuracy (%)',
        data: byIdx.mean,
        borderColor: 'rgb(34,197,94)',
        backgroundColor: 'rgba(34,197,94,0.2)',
        pointRadius: 0,
        tension: 0.25,
        yAxisID: 'y',
      },
      {
        label: 'Expected Std Dev',
        data: byIdx.std,
        borderColor: 'rgb(156,163,175)',
        backgroundColor: 'rgba(156,163,175,0.2)',
        pointRadius: 0,
        tension: 0.25,
        yAxisID: 'y2',
      },
    ],
  }), [byIdx, metric])

  const idxOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: theme.textPrimary } },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
      y: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
      y2: { position: 'right' as const, grid: { drawOnChartArea: false }, ticks: { color: theme.textSecondary } },
    },
  }), [theme])

  const bestData = useMemo(() => ({
    labels: bestVsL.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: metric === 'score' ? 'Expected Best Score (≤ L runs)' : 'Expected Best Accuracy (≤ L runs)',
        data: bestVsL,
        borderColor: 'rgb(59,130,246)',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'rgba(59,130,246,0.2)'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(59,130,246,0.3)')
          g.addColorStop(1, 'rgba(59,130,246,0.0)')
          return g
        },
        pointRadius: 0,
        tension: 0.25,
        fill: 'start',
      },
    ],
  }), [bestVsL, metric])

  const bestOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: theme.textPrimary } },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
      y: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
    },
  }), [theme])

  const NotEnough = runs.length === 0 || (byIdx.mean.length === 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartBox
          title="Optimal session length — performance by run index"
          info={<div>
            <div className="mb-2">Shows expected performance and variability at each run index across your sessions. We estimate warm‑up and suggest a session length based on average, consistency, and high‑score goals.</div>
            <ul className="list-disc pl-5 text-[var(--text-secondary)]">
              <li>Warm‑up = where improvement rate slows and variability drops.</li>
              <li>Average = session length maximizing expected average performance.</li>
              <li>Consistency = shortest length where recent variability is below typical.</li>
            </ul>
          </div>}
          controls={{
            dropdown: {
              label: 'Metric',
              value: metric,
              onChange: (v: string) => setMetric(v as Metric),
              options: [
                { label: 'Score', value: 'score' },
                { label: 'Accuracy (%)', value: 'acc' },
              ],
            },
          }}
          height={320}
        >
          {NotEnough ? (
            <div className="h-full grid place-items-center text-sm text-[var(--text-secondary)]">Not enough data to estimate yet.</div>
          ) : (
            <div className="h-full">
              <Line data={idxData as any} options={idxOptions as any} />
            </div>
          )}
        </ChartBox>
        <ChartBox
          title="Expected best vs session length"
          info={<div>
            <div className="mb-2">Expected best performance within the first L runs of a session. We pick the smallest L within 1% of the maximum and with low marginal gains.</div>
          </div>}
          height={320}
        >
          {NotEnough ? (
            <div className="h-full grid place-items-center text-sm text-[var(--text-secondary)]">Not enough data to estimate yet.</div>
          ) : (
            <div className="h-full">
              <Line data={bestData as any} options={bestOptions as any} />
            </div>
          )}
        </ChartBox>
      </div>

      {/* Summary line */}
      {!NotEnough && (
        <div className="text-xs text-[var(--text-secondary)]">
          Recommended length: <b className="text-[var(--text-primary)]">{rec.optimalAvgRuns}</b> runs (avg)&nbsp;• Consistency: <b className="text-[var(--text-primary)]">{rec.optimalConsistentRuns}</b>&nbsp;• High‑score: <b className="text-[var(--text-primary)]">{rec.optimalHighscoreRuns}</b>&nbsp;• Warm‑up ~ <b className="text-[var(--text-primary)]">{rec.warmupRuns}</b>
        </div>
      )}
    </div>
  )
}

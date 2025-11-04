import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { ChartBox } from '..'
import { useChartTheme } from '../../hooks/useChartTheme'
import { Metric, collectRunsBySession, expectedAvgVsLength, expectedBestVsLength, expectedByIndex, recommendLengths } from '../../lib/analysis/sessionLength'
import type { Session } from '../../types/domain'

type SessionLengthInsightsProps = { sessions: Session[]; scenarioName: string }

export function SessionLengthInsights({ sessions, scenarioName }: SessionLengthInsightsProps) {
  const theme = useChartTheme()
  const [metric, setMetric] = useState<Metric>('score')

  const runs = useMemo(() => collectRunsBySession(sessions, scenarioName), [sessions, scenarioName])
  const byIdx = useMemo(() => expectedByIndex(runs, metric), [runs, metric])
  const bestVsL = useMemo(() => expectedBestVsLength(runs, metric), [runs, metric])
  const avgVsL = useMemo(() => expectedAvgVsLength(runs, metric), [runs, metric])
  const rec = useMemo(() => recommendLengths(byIdx, bestVsL, avgVsL), [byIdx, bestVsL, avgVsL])

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

  const avgData = useMemo(() => ({
    labels: avgVsL.mean.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: metric === 'score' ? 'Avg of first L runs' : 'Avg Accuracy of first L runs (%)',
        data: avgVsL.mean,
        borderColor: 'rgb(34,197,94)',
        backgroundColor: 'rgba(34,197,94,0.15)',
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Min (per-session avg at L)',
        data: avgVsL.min,
        borderColor: 'rgba(239,68,68,0.9)',
        backgroundColor: 'rgba(239,68,68,0.1)',
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Max (per-session avg at L)',
        data: avgVsL.max,
        borderColor: 'rgba(16,185,129,0.9)',
        backgroundColor: 'rgba(16,185,129,0.1)',
        pointRadius: 0,
        tension: 0.25,
      },
    ],
  }), [avgVsL, metric])

  const avgOptions = useMemo(() => ({
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
      {/* Emphasized recommendations summary */}
      {!NotEnough && (
        <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--text-secondary)]">
            <div>
              <span className="mr-2">Recommended Session length:</span>
              <b className="text-[var(--text-primary)]">{rec.optimalAvgRuns}</b> runs (avg)
            </div>
            <div>
              • Consistency: <b className="text-[var(--text-primary)]">{rec.optimalConsistentRuns}</b> runs
            </div>
            <div>
              • High‑score: <b className="text-[var(--text-primary)]">{rec.optimalHighscoreRuns}</b> runs
            </div>
            <div>
              • Warm‑up ~ <b className="text-[var(--text-primary)]">{rec.warmupRuns}</b> runs
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartBox
          title="Optimal session length"
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
          height={240}
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
          height={240}
        >
          {NotEnough ? (
            <div className="h-full grid place-items-center text-sm text-[var(--text-secondary)]">Not enough data to estimate yet.</div>
          ) : (
            <div className="h-full">
              <Line data={bestData as any} options={bestOptions as any} />
            </div>
          )}
        </ChartBox>
        <ChartBox
          title="Avg performance vs session length"
          info={<div>
            <div className="mb-2">For each length L, we compute each session’s average over its first L runs, then aggregate across sessions. This shows the typical average performance and its bounds at different lengths.</div>
            <ul className="list-disc pl-5 text-[var(--text-secondary)]">
              <li>Mean = expected average if you play L runs.</li>
              <li>Min/Max = lowest/highest per-session averages at L (across your data).</li>
              <li>Use this with the Best vs L chart to balance consistency vs. peak hunting.</li>
            </ul>
          </div>}
          height={240}
        >
          {NotEnough ? (
            <div className="h-full grid place-items-center text-sm text-[var(--text-secondary)]">Not enough data to estimate yet.</div>
          ) : (
            <div className="h-full">
              <Line data={avgData as any} options={avgOptions as any} />
            </div>
          )}
        </ChartBox>
      </div>
    </div>
  )
}

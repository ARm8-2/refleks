import { useMemo } from 'react'
import { Scatter } from 'react-chartjs-2'
import { ChartBox } from '..'
import { useChartTheme } from '../../hooks/useChartTheme'
import { usePageState } from '../../hooks/usePageState'
import { getScenarioName } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'

export function PerformanceVsSensChart({ items, scenarioName }: { items: ScenarioRecord[]; scenarioName: string }) {
  const colors = useChartTheme()
  // Persist the selected metric per-scenario so the user's choice sticks while browsing
  const [metric, setMetric] = usePageState<'score' | 'acc' | 'ttk'>(`sens:metric:${scenarioName}`, 'score')

  const points = useMemo(() => {
    const pts: Array<{ x: number; y: number; i: number }> = []
    let idx = 0
    for (const it of items) {
      if (getScenarioName(it) !== scenarioName) continue
      const cm = Number(it.stats['cm/360'] ?? 0)
      // compute Y value according to selected metric
      let y = NaN
      if (metric === 'score') y = Number(it.stats['Score'] ?? NaN)
      else if (metric === 'acc') {
        const a01 = Number(it.stats['Accuracy'] ?? NaN)
        y = Number.isFinite(a01) ? a01 * 100 : NaN
      } else if (metric === 'ttk') y = Number(it.stats['Real Avg TTK'] ?? NaN)

      if (!Number.isFinite(cm) || cm <= 0) continue
      if (!Number.isFinite(y)) continue
      pts.push({ x: cm, y, i: idx++ })
    }
    // Sort by cm ascending for nicer tooltips
    pts.sort((a, b) => a.x - b.x || a.i - b.i)
    return pts
  }, [items, scenarioName, metric])

  // Oldest -> newest gradient coloring
  const maxIndex = useMemo(() => points.reduce((m, p) => Math.max(m, p.i), -1), [points])

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  // Slate(older) -> Amber(newer)
  const colorAt = (t: number, forBorder = false) => {
    // clamp
    if (t < 0) t = 0
    if (t > 1) t = 1
    const o = { r: 148, g: 163, b: 184, a: forBorder ? 0.7 : 0.45 }
    const n = { r: 234, g: 179, b: 8, a: forBorder ? 0.95 : 0.8 }
    const r = Math.round(lerp(o.r, n.r, t))
    const g = Math.round(lerp(o.g, n.g, t))
    const b = Math.round(lerp(o.b, n.b, t))
    const a = lerp(o.a, n.a, t)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  const metricLabel = metric === 'score' ? 'Score' : (metric === 'acc' ? 'Accuracy (%)' : 'Real Avg TTK (s)')

  const data = useMemo(() => ({
    datasets: [
      {
        label: `${metricLabel} vs Sensitivity`,
        data: points,
        parsing: false,
        showLine: false,
        // Fallback colors (overridden per-point below)
        borderColor: 'rgb(234, 179, 8)',
        backgroundColor: 'rgba(234, 179, 8, 0.45)',
        pointBackgroundColor: (ctx: any) => {
          const p = ctx.raw as { i: number }
          const t = maxIndex > 0 ? p.i / maxIndex : 1
          return colorAt(t, false)
        },
        pointBorderColor: (ctx: any) => {
          const p = ctx.raw as { i: number }
          const t = maxIndex > 0 ? p.i / maxIndex : 1
          return colorAt(t, true)
        },
        pointRadius: 3,
        pointHoverRadius: 4,
      },
    ],
  }), [points, maxIndex, metricLabel])

  const xMax = useMemo(() => points.reduce((m, p) => Math.max(m, p.x), 0), [points])
  const xMin = useMemo(() => points.reduce((m, p) => Math.min(m, p.x), Number.POSITIVE_INFINITY), [points])

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
          title: () => 'Run',
          label: (ctx: any) => {
            const p = ctx.raw as { x: number; y: number; i: number }
            const lines: string[] = []
            lines.push(`cm/360: ${p.x.toFixed(2)}`)
            if (metric === 'score') lines.push(`Score: ${p.y.toFixed(1)}`)
            else if (metric === 'acc') lines.push(`Accuracy: ${p.y.toFixed(1)}%`)
            else if (metric === 'ttk') lines.push(`TTK: ${p.y.toFixed(2)}s`)
            return lines
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Sensitivity (cm/360) — lower is faster', color: colors.textSecondary },
        ticks: { color: colors.textSecondary },
        grid: { color: colors.grid },
        suggestedMin: Number.isFinite(xMin) ? Math.max(0, Math.floor(xMin - 1)) : 0,
        suggestedMax: Math.ceil((xMax || 20) * 1.05),
      },
      y: {
        title: { display: true, text: metricLabel, color: colors.textSecondary },
        ticks: { color: colors.textSecondary, callback: metric === 'acc' ? (v: any) => `${v}%` : undefined },
        grid: { color: colors.grid },
      },
    },
  }), [colors, xMax, xMin, metric])

  return (
    <ChartBox
      title="Performance vs Sens (cm/360)"
      controls={{
        dropdown: {
          label: 'Metric',
          value: metric,
          onChange: (v: string) => setMetric(v as any),
          options: [
            { label: 'Score', value: 'score' },
            { label: 'Accuracy (%)', value: 'acc' },
            { label: 'Real Avg TTK (s)', value: 'ttk' },
          ],
        },
      }}
      info={<div>
        <div className="mb-2">Each point is a run for this scenario. X is your effective sensitivity (cm per full 360° turn), Y is the selected performance metric ({metric === 'score' ? 'Score' : metric === 'acc' ? 'Accuracy (%)' : 'Real Avg TTK (s)'}).</div>
        <ul className="list-disc pl-5 text-[var(--text-secondary)]">
          <li>We only plot runs where sensitivity could be computed. Unsupported scales appear as cm/360 = 0 and are omitted.</li>
          <li>Lower cm/360 means higher sensitivity. Try comparing clusters to find your sweet spot.</li>
          <li>Point color shows recency: greyish = older, amber = newer.</li>
        </ul>
      </div>}
      height={300}
    >
      <div className="h-full">
        <Scatter data={data as any} options={options as any} />
      </div>
    </ChartBox>
  )
}

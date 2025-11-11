import { useMemo } from 'react'
import { Scatter } from 'react-chartjs-2'
import { ChartBox } from '..'
import { useChartTheme } from '../../hooks/useChartTheme'
import { usePageState } from '../../hooks/usePageState'
import { getScenarioName } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'

type PerformanceVsSensChartProps = {
  items: ScenarioRecord[]
  scenarioName: string
}

export function PerformanceVsSensChart({ items, scenarioName }: PerformanceVsSensChartProps) {
  const colors = useChartTheme()
  // Persist the selected metric per-scenario so the user's choice sticks while browsing
  const [metric, setMetric] = usePageState<'score' | 'acc' | 'ttk'>(`sens:metric:${scenarioName}`, 'score')
  // We'll compute two things here: the plotted points (aligned to bin centers) and
  // the histogram bins (start/end/center/count). We align plotted points to the
  // center of the bin they belong to so they visually line up with the bar range,
  // but we keep the original cm/360 value on each point as `origX` so tooltips
  // can still show the precise measured sensitivity.
  const { points, bins, rawXMin, rawXMax } = useMemo(() => {
    type RawPt = { x: number; y: number; i: number }
    const raw: RawPt[] = []
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
      raw.push({ x: cm, y, i: idx++ })
    }

    if (raw.length === 0) return { points: [] as any[], bins: [] as any[], rawXMin: 0, rawXMax: 0 }

    // Sort by cm ascending for nicer tooltips
    raw.sort((a, b) => a.x - b.x || a.i - b.i)

    const xs = raw.map(p => p.x)
    const n = xs.length
    let xMin = Math.min(...xs)
    let xMax = Math.max(...xs)

    // If all values equal, add a small padding so bins have width
    if (xMax === xMin) {
      const pad = Math.max(0.5, Math.abs(xMin) * 0.05)
      xMin = xMin - pad
      xMax = xMax + pad
    }

    // Helper: linear interpolation for percentiles
    const percentile = (arr: number[], p: number) => {
      if (!arr.length) return NaN
      const pos = (arr.length - 1) * p
      const base = Math.floor(pos)
      const rest = pos - base
      if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base])
      return arr[base]
    }

    // Freedman-Diaconis rule for bin width, fallback to sqrt(n) based binning
    const q1 = percentile(xs, 0.25)
    const q3 = percentile(xs, 0.75)
    const iqr = q3 - q1
    const fdWidth = (iqr > 0 && n > 0) ? (2 * iqr / Math.cbrt(n)) : 0
    let binWidth = Number.isFinite(fdWidth) && fdWidth > 0 ? fdWidth : (xMax - xMin) / Math.max(3, Math.round(Math.sqrt(n)))
    if (!Number.isFinite(binWidth) || binWidth <= 0) binWidth = (xMax - xMin) / Math.max(1, Math.round(Math.sqrt(n)))

    let binCount = Math.max(1, Math.ceil((xMax - xMin) / binWidth))
    // clamp bin count to a reasonable range
    binCount = Math.max(1, Math.min(50, binCount))
    // recompute exact width so bins exactly span the range
    binWidth = (xMax - xMin) / binCount

    const bins: Array<{ start: number; end: number; center: number; count: number }> = []
    for (let i = 0; i < binCount; i++) {
      const start = xMin + i * binWidth
      const end = start + binWidth
      bins.push({ start, end, center: (start + end) / 2, count: 0 })
    }

    // Assign raw points to bins and create plotted points aligned to bin centers.
    const plotted: Array<{ x: number; y: number; i: number; origX: number }> = []
    for (const p of raw) {
      let bi = Math.floor((p.x - xMin) / binWidth)
      if (bi < 0) bi = 0
      if (bi >= bins.length) bi = bins.length - 1
      bins[bi].count++
      plotted.push({ x: bins[bi].center, y: p.y, i: p.i, origX: p.x })
    }

    return { points: plotted, bins, rawXMin: xMin, rawXMax: xMax }
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
  // Build two datasets: a histogram (bar) dataset for counts and
  // a scatter dataset for individual runs. The bar dataset is interactive
  // so hovering over a bar will surface a tooltip with the bin range/count.
  const data = useMemo(() => ({
    datasets: [
      // Histogram bars (rendered by Chart.js so they are interactive)
      {
        type: 'bar' as const,
        label: 'Sensitivity histogram',
        data: bins.map(b => ({ x: b.center, y: b.count })),
        parsing: false,
        backgroundColor: 'rgba(148,163,184,0.06)',
        borderColor: 'rgba(148,163,184,0.08)',
        borderWidth: 1,
        // Draw behind the scatter
        order: 1,
        // Use the exact pixel width of each computed bin so bars match the
        // numeric ranges. This is a scriptable option that runs during layout.
        barThickness: (ctx: any) => {
          try {
            const chart = ctx.chart
            const scale = chart.scales.x
            const b = bins[ctx.dataIndex]
            if (!scale || !b) return undefined
            const left = scale.getPixelForValue(b.start)
            const right = scale.getPixelForValue(b.end)
            return Math.max(2, Math.round(right - left))
          } catch (e) {
            return undefined
          }
        },
        yAxisID: 'yCount',
      },

      // Scatter points (aligned to bin centers but carrying origX for tooltips)
      {
        label: `${metricLabel} vs Sensitivity`,
        data: points,
        parsing: false,
        showLine: false,
        // Fallback colors (overridden per-point below)
        borderColor: 'rgb(234, 179, 8)',
        backgroundColor: 'rgba(234, 179, 8, 0.65)',
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
        // Increase hit area so users don't have to be pixel-perfect when hovering.
        pointHitRadius: 8,
        order: 2,
      },
    ],
  }), [bins, points, maxIndex, metricLabel])

  // Use original raw bounds (before aligning to bin centers) for axis suggestions
  const xMax = rawXMax
  const xMin = rawXMin

  // No custom plugin needed anymore; the bar dataset handles rendering and
  // interactions. Keeping the plugin would duplicate visuals and prevent
  // hover interactions over the bars.

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: false },
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
            // If hovering a histogram bar, show the bin range and count.
            const dsType = ctx.dataset && (ctx.dataset.type || ctx.dataset._metaType)
            if (ctx.dataset && (ctx.dataset.type === 'bar' || ctx.dataset.label === 'Sensitivity histogram')) {
              const b = bins[ctx.dataIndex]
              if (b) return [`Range: ${b.start.toFixed(2)}–${b.end.toFixed(2)} cm/360`, `Runs: ${b.count}`]
              return [`Runs: ${ctx.parsed.y}`]
            }

            // Otherwise this is a scatter point representing a run.
            const p = ctx.raw as { x: number; y: number; i: number; origX?: number }
            const rawX = typeof p.origX === 'number' ? p.origX : p.x
            const lines: string[] = []
            lines.push(`cm/360: ${rawX.toFixed(2)}`)
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
      // Secondary axis for histogram counts
      yCount: {
        position: 'right' as const,
        title: { display: true, text: 'Runs', color: colors.textSecondary },
        ticks: { color: colors.textSecondary, precision: 0 },
        grid: { display: false },
        beginAtZero: true,
        suggestedMax: bins && bins.length ? Math.max(1, Math.ceil(bins.reduce((m, b) => Math.max(m, b.count), 0) * 1.15)) : undefined,
      },
    },
  }), [colors, xMax, xMin, metric, bins])

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

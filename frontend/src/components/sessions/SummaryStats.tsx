import { useMemo } from 'react'

function slope(arr: number[]): number {
  const y = [...arr].reverse() // oldest -> newest
  const n = y.length
  if (n < 2) return 0
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let i = 0; i < n; i++) {
    const x = i + 1
    const v = Number.isFinite(y[i]) ? y[i] : 0
    sumX += x
    sumY += v
    sumXY += x * v
    sumXX += x * x
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

export function SummaryStats({
  score,
  acc,
  ttk,
  firstPct,
  lastPct,
}: {
  score: number[]
  acc: number[]
  ttk: number[]
  firstPct: number
  lastPct: number
}) {
  const triangle = (dir: 'up' | 'down', colorVar: string) => (
    <span
      className="inline-block align-[-2px] text-[10px] leading-none"
      style={{ color: `var(${colorVar})` }}
      aria-hidden
    >
      {dir === 'up' ? '▲' : '▼'}
    </span>
  )

  const mean = (arr: number[]) => {
    const v = arr.filter(n => Number.isFinite(n))
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
  }
  const windowDelta = (arr: number[]) => {
    const n = arr.length
    if (n === 0) return 0
    const nF = Math.max(1, Math.floor((firstPct / 100) * n))
    const nL = Math.max(1, Math.floor((lastPct / 100) * n))
    const earliest = arr.slice(-nF) // oldest window
    const latest = arr.slice(0, nL) // newest window
    return mean(latest) - mean(earliest)
  }

  const data = useMemo(() => ({
    latest: { score: score[0] ?? NaN, acc: acc[0] ?? NaN, ttk: ttk[0] ?? NaN },
    delta: { score: windowDelta(score), acc: windowDelta(acc), ttk: windowDelta(ttk) },
    slope: { score: slope(score), acc: slope(acc), ttk: slope(ttk) },
  }), [score, acc, ttk, firstPct, lastPct])

  const Stat = ({ label, value, fmt, delta, slopeVal }: { label: string; value: number; fmt: (n: number) => string; delta: number; slopeVal: number }) => {
    const dir = (delta !== 0 ? delta : slopeVal) >= 0 ? 'up' : 'down'
    const good = label === 'Real Avg TTK' ? dir === 'down' : (dir === 'up')
    const colorVar = good ? '--success' : '--error'
    const formattedDelta = (
      label === 'Accuracy'
        ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
        : label === 'Real Avg TTK'
          ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}s`
          : `${delta >= 0 ? '+' : ''}${Math.round(delta)}`
    )
    return (
      <div className="flex-1 min-w-[160px] p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
        <div className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
          <span>{fmt(value)}</span>
          <span className="flex items-center gap-1 text-xs" aria-label={`Change vs first: ${formattedDelta}`}>
            {triangle(dir, colorVar)}
            <span className="color-[var(--text-primary)]">{formattedDelta}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      <div className="px-3 py-2 border-b border-[var(--border-primary)] text-sm font-medium text-[var(--text-primary)] flex items-center justify-between">
        <span>Session summary</span>
        <span className="text-xs text-[var(--text-secondary)]">Δ window: last {lastPct}% vs first {firstPct}%</span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Score" value={data.latest.score} fmt={(n) => Math.round(n).toString()} delta={data.delta.score} slopeVal={data.slope.score} />
        <Stat label="Accuracy" value={data.latest.acc} fmt={(n) => `${n.toFixed(1)}%`} delta={data.delta.acc} slopeVal={data.slope.acc} />
        <Stat label="Real Avg TTK" value={data.latest.ttk} fmt={(n) => `${n.toFixed(2)}s`} delta={data.delta.ttk} slopeVal={data.slope.ttk} />
      </div>
    </div>
  )
}

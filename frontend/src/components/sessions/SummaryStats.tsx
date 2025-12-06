import { useMemo } from 'react'
import { usePageState } from '../../hooks/usePageState'
import { formatNumber, formatPct, formatSeconds } from '../../lib/utils'
import { Dropdown } from '../shared/Dropdown'

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

type SummaryStatsProps = {
  score: number[]
  acc: number[]
  ttk: number[]
  title?: string
  storageKeyPrefix: string
}

type StatProps = { label: string; value: number; fmt: (n: number) => string; delta: number; slopeVal: number }

export function SummaryStats({
  score,
  acc,
  ttk,
  title = 'Session summary',
  storageKeyPrefix,
}: SummaryStatsProps) {
  const [firstPct, setFirstPct] = usePageState<number>(`${storageKeyPrefix}:firstPct`, 30)
  const [lastPct, setLastPct] = usePageState<number>(`${storageKeyPrefix}:lastPct`, 30)

  const pctOptions = [20, 25, 30, 40, 50]
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

  const Stat = ({ label, value, fmt, delta, slopeVal }: StatProps) => {
    const dir = (delta !== 0 ? delta : slopeVal) >= 0 ? 'up' : 'down'
    const good = label === 'Real Avg TTK' ? dir === 'down' : (dir === 'up')
    const colorVar = good ? '--success' : '--error'
    const formattedDelta = (
      label === 'Accuracy'
        ? `${delta >= 0 ? '+' : ''}${formatPct(delta)}`
        : label === 'Real Avg TTK'
          ? `${delta >= 0 ? '+' : ''}${formatSeconds(delta)}`
          : `${delta >= 0 ? '+' : ''}${formatNumber(delta, 0)}`
    )
    return (
      <div className="flex-1 min-w-[160px] p-3 rounded border border-primary bg-surface-3">
        <div className="text-xs text-secondary">{label}</div>
        <div className="text-lg font-medium text-primary flex items-center gap-2">
          <span>{fmt(value)}</span>
          <span className="flex items-center gap-1 text-xs" aria-label={`Change vs first: ${formattedDelta}`}>
            {triangle(dir, colorVar)}
            <span className="text-primary">{formattedDelta}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 rounded border border-primary bg-surface-2">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-primary">{title}</div>
        <div className="flex items-center gap-2 text-xs text-secondary">
          <span>Compare first</span>
          <Dropdown
            size="sm"
            value={String(firstPct)}
            onChange={(v) => setFirstPct(Number(v))}
            options={pctOptions.map(p => ({ label: `${p}%`, value: String(p) }))}
          />
          <span>vs last</span>
          <Dropdown
            size="sm"
            value={String(lastPct)}
            onChange={(v) => setLastPct(Number(v))}
            options={pctOptions.map(p => ({ label: `${p}%`, value: String(p) }))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Stat label="Score" value={data.latest.score} fmt={(v) => formatNumber(v, 0)} delta={data.delta.score} slopeVal={data.slope.score} />
        <Stat label="Accuracy" value={data.latest.acc} fmt={(v) => formatPct(v)} delta={data.delta.acc} slopeVal={data.slope.acc} />
        <Stat label="Real Avg TTK" value={data.latest.ttk} fmt={(v) => formatSeconds(v)} delta={data.delta.ttk} slopeVal={data.slope.ttk} />
      </div>
    </div>
  )
}

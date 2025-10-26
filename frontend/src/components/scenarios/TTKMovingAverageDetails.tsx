import { ArrowRight } from 'lucide-react'
import { InfoBox } from '..'

export function TTKMovingAverageDetails({
  movingAvg,
}: {
  movingAvg: {
    slope: number
    r2: number
    ma5NetChange?: number
    meanMA5?: number
    stdMA5?: number
    meanRollStd5?: number
    stableSegments: Array<{ start: number; end: number }>
  }
}) {
  const fmt = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : v.toFixed(3))
  const fmtIdx = (i: number) => `#${i + 1}`
  const info = (
    <div>
      <div className="mb-2">How to read these metrics:</div>
      <ul className="list-disc pl-5 text-[var(--text-secondary)]">
        <li>Trend slope is the per-kill change in the moving average TTK; negative means TTK improves over time.</li>
        <li>R² indicates how well a linear model fits the moving average sequence.</li>
        <li>Stable segments are contiguous ranges where rolling standard deviation (window 5) is below the median across the run.</li>
      </ul>
    </div>
  )
  return (
    <div className="mt-2">
      <InfoBox title="TTK moving average — metrics" info={info}>
        <ul className="space-y-1">
          <li>Trend slope: <b className="text-[var(--text-primary)]">{fmt(movingAvg.slope)}</b> s/kill • Linear fit R²: <b className="text-[var(--text-primary)]">{fmt(movingAvg.r2)}</b></li>
          <li>MA(5) mean/std: <b className="text-[var(--text-primary)]">{fmt(movingAvg.meanMA5)}</b>s / <b className="text-[var(--text-primary)]">{fmt(movingAvg.stdMA5)}</b>s • Net change: <b className="text-[var(--text-primary)]">{fmt(movingAvg.ma5NetChange)}</b>s</li>
          <li>Rolling std (window 5) mean: <b className="text-[var(--text-primary)]">{fmt(movingAvg.meanRollStd5)}</b></li>
          {movingAvg.stableSegments.length > 0 && (
            <li>Stable segments (low variance): {movingAvg.stableSegments.map((seg, i) => (
              <span key={i} className="mr-2 inline-flex items-center gap-1">[
                <span>{fmtIdx(seg.start)}</span>
                <ArrowRight size={12} className="inline-block align-[-2px] opacity-80" />
                <span>{fmtIdx(seg.end)}</span>
                ]</span>
            ))}</li>
          )}
        </ul>
      </InfoBox>
    </div>
  )
}

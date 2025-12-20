import { ArrowRight } from 'lucide-react'
import { CHART_DECIMALS } from '../../lib/constants'
import { formatNumber, formatSeconds } from '../../lib/utils'
import { InfoBox } from '../shared/InfoBox'

type TTKMovingAverageDetailsProps = {
  movingAvg: {
    slope: number
    r2: number
    ma5NetChange?: number
    meanMA5?: number
    stdMA5?: number
    meanRollStd5?: number
    stableSegments: Array<{ start: number; end: number }>
  }
}

export function TTKMovingAverageDetails({
  movingAvg,
}: TTKMovingAverageDetailsProps) {
  const fmt = (v: number | undefined) => formatNumber(v, CHART_DECIMALS.detailNum)
  const fmtIdx = (i: number) => `#${i + 1}`
  const infoContent = (
    <div>
      <div className="mb-2">How to read these metrics:</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Trend slope is the per-kill change in the moving average TTK; negative means TTK improves over time.</li>
        <li>R² indicates how well a linear model fits the moving average sequence.</li>
        <li>Stable segments are contiguous ranges where rolling standard deviation (window 5) is below the median across the run.</li>
      </ul>
    </div>
  )
  return (
    <div className="mt-2">
      <InfoBox id="scenarios:ttk-moving-average-metrics" title="TTK moving average - metrics" info={infoContent}>
        <ul className="space-y-1">
          <li>Trend slope: <b className="text-primary">{formatSeconds(movingAvg.slope, CHART_DECIMALS.ttkTooltip)}</b> s/kill • Linear fit R²: <b className="text-primary">{fmt(movingAvg.r2)}</b></li>
          <li>MA(5) mean/std: <b className="text-primary">{formatSeconds(movingAvg.meanMA5, CHART_DECIMALS.ttkTooltip)}</b> / <b className="text-primary">{formatSeconds(movingAvg.stdMA5, CHART_DECIMALS.ttkTooltip)}</b> • Net change: <b className="text-primary">{formatSeconds(movingAvg.ma5NetChange, CHART_DECIMALS.ttkTooltip)}</b></li>
          <li>Rolling std (window 5) mean: <b className="text-primary">{formatNumber(movingAvg.meanRollStd5, CHART_DECIMALS.detailNum)}</b></li>
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

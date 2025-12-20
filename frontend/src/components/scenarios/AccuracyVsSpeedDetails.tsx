import { CHART_DECIMALS } from '../../lib/constants'
import { formatNumber, formatPct } from '../../lib/utils'
import { InfoBox } from '../shared/InfoBox'

type AccuracyVsSpeedDetailsProps = {
  scatter: {
    corrKpmAcc: number
    meanBinStdAcc: number
    binsUsed: number
    medianNNDist: number
    centroidKPM?: number
    centroidAcc?: number
    clusterCompactness?: number
  }
}

export function AccuracyVsSpeedDetails({
  scatter,
}: AccuracyVsSpeedDetailsProps) {
  const fmt = (v: number | undefined) => formatNumber(v, CHART_DECIMALS.detailNum)
  const fmtPct = (v: number | undefined) => formatPct(v, CHART_DECIMALS.pctTooltip)
  const infoContent = (
    <div>
      <div className="mb-2">How to read these metrics:</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Pearson r measures linear correlation between speed (KPM) and per-kill accuracy.</li>
        <li>Within-speed-bin std is the average variability of accuracy at similar speeds (lower is tighter control).</li>
        <li>Median nearest-neighbor distance reflects clustering tightness of individual kills in normalized space.</li>
        <li>Centroid is the average point; compactness is the average distance from this centroid.</li>
      </ul>
    </div>
  )
  return (
    <div className="mt-2">
      <InfoBox id="scenarios:accuracy-vs-speed-metrics" title="Accuracy vs speed - metrics" info={infoContent}>
        <ul className="space-y-1">
          <li>Pearson r (KPM vs accuracy): <b className="text-primary">{fmt(scatter.corrKpmAcc)}</b></li>
          <li>Within-speed-bin accuracy std (avg across {scatter.binsUsed} bins): <b className="text-primary">{fmt(scatter.meanBinStdAcc)}</b></li>
          <li>Median nearest-neighbor distance (normalized): <b className="text-primary">{fmt(scatter.medianNNDist)}</b></li>
          <li>Centroid: KPM <b className="text-primary">{fmt(scatter.centroidKPM)}</b> • Acc <b className="text-primary">{fmtPct(scatter.centroidAcc)}</b></li>
          <li>Cluster compactness (avg distance to centroid, normalized): <b className="text-primary">{fmt(scatter.clusterCompactness)}</b></li>
        </ul>
      </InfoBox>
    </div>
  )
}

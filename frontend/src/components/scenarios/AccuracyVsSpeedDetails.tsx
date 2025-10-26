import { InfoBox } from '..'

export function AccuracyVsSpeedDetails({
  scatter,
}: {
  scatter: {
    corrKpmAcc: number
    meanBinStdAcc: number
    binsUsed: number
    medianNNDist: number
    centroidKPM?: number
    centroidAcc?: number
    clusterCompactness?: number
  }
}) {
  const fmt = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : v.toFixed(3))
  const fmtPct = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : `${(v * 100).toFixed(1)}%`)
  const info = (
    <div>
      <div className="mb-2">How to read these metrics:</div>
      <ul className="list-disc pl-5 text-[var(--text-secondary)]">
        <li>Pearson r measures linear correlation between speed (KPM) and per-kill accuracy.</li>
        <li>Within-speed-bin std is the average variability of accuracy at similar speeds (lower is tighter control).</li>
        <li>Median nearest-neighbor distance reflects clustering tightness of individual kills in normalized space.</li>
        <li>Centroid is the average point; compactness is the average distance from this centroid.</li>
      </ul>
    </div>
  )
  return (
    <div className="mt-2">
      <InfoBox title="Accuracy vs speed — metrics" info={info}>
        <ul className="space-y-1">
          <li>Pearson r (KPM vs accuracy): <b className="text-[var(--text-primary)]">{fmt(scatter.corrKpmAcc)}</b></li>
          <li>Within-speed-bin accuracy std (avg across {scatter.binsUsed} bins): <b className="text-[var(--text-primary)]">{fmt(scatter.meanBinStdAcc)}</b></li>
          <li>Median nearest-neighbor distance (normalized): <b className="text-[var(--text-primary)]">{fmt(scatter.medianNNDist)}</b></li>
          <li>Centroid: KPM <b className="text-[var(--text-primary)]">{fmt(scatter.centroidKPM)}</b> • Acc <b className="text-[var(--text-primary)]">{fmtPct(scatter.centroidAcc)}</b></li>
          <li>Cluster compactness (avg distance to centroid, normalized): <b className="text-[var(--text-primary)]">{fmt(scatter.clusterCompactness)}</b></li>
        </ul>
      </InfoBox>
    </div>
  )
}

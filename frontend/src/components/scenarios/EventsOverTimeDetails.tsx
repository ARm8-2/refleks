import { InfoBox } from '..'

export function EventsOverTimeDetails({ summary }: {
  summary: {
    kills: number
    shots: number
    hits: number
    finalAcc: number
    longestGap: number
    avgGap: number
    avgTTK: number
    medianTTK: number
    stdTTK: number
    p10TTK?: number
    p90TTK?: number
    meanKPM?: number
  }
}) {
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '-')
  const fmtS = (v: number) => (Number.isFinite(v) ? `${v.toFixed(2)}s` : '-')

  const info = (
    <div>
      <div className="mb-2">How to read these metrics:</div>
      <ul className="list-disc pl-5 text-[var(--text-secondary)]">
        <li>TTK average/median/std describe the central tendency and spread of time-to-kill between kills.</li>
        <li>p10/p90 show the 10th and 90th percentile TTK, giving a robust range excluding extremes.</li>
        <li>Gaps indicate pauses between kills; unusually long gaps may reflect downtime or missed targets.</li>
        <li>Average KPM is the mean kill rate derived from real TTK values.</li>
      </ul>
    </div>
  )

  return (
    <div className="mt-2">
      <InfoBox title="Kills over time — metrics" info={info}>
        <ul className="space-y-1">
          <li>Kills: <b className="text-[var(--text-primary)]">{summary.kills}</b> • Shots: <b className="text-[var(--text-primary)]">{summary.shots}</b> • Hits: <b className="text-[var(--text-primary)]">{summary.hits}</b> • Final accuracy: <b className="text-[var(--text-primary)]">{fmtPct(summary.finalAcc)}</b></li>
          <li>TTK avg/median/std: <b className="text-[var(--text-primary)]">{fmt(summary.avgTTK)}</b>s / <b className="text-[var(--text-primary)]">{fmt(summary.medianTTK)}</b>s / <b className="text-[var(--text-primary)]">{fmt(summary.stdTTK)}</b>s</li>
          {(summary.p10TTK !== undefined || summary.p90TTK !== undefined) && (
            <li>TTK p10 / p90: <b className="text-[var(--text-primary)]">{fmt(summary.p10TTK!)}</b>s / <b className="text-[var(--text-primary)]">{fmt(summary.p90TTK!)}</b>s</li>
          )}
          <li>Gaps: longest {fmtS(summary.longestGap)} • average {fmtS(summary.avgGap)}</li>
          {summary.meanKPM !== undefined && (
            <li>Average speed: <b className="text-[var(--text-primary)]">{fmt(summary.meanKPM!)}</b> KPM</li>
          )}
        </ul>
      </InfoBox>
    </div>
  )
}

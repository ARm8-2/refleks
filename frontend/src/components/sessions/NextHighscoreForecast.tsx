import type { HighscorePrediction } from '../../lib/analysis/prediction';
import { InfoBox } from '../shared/InfoBox';
import { PreviewTag } from '../shared/PreviewTag';

type NextHighscoreForecastProps = { pred: HighscorePrediction }

export function NextHighscoreForecast({ pred }: NextHighscoreForecastProps) {

  const badge = (c: 'low' | 'med' | 'high') => {
    const cls = c === 'high' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : c === 'med' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : 'bg-slate-500/20 text-slate-300 border-slate-500/40'
    const label = c === 'high' ? 'High' : c === 'med' ? 'Medium' : 'Low'
    return <span className={`px-2 py-0.5 rounded text-xs border ${cls}`}>{label}</span>
  }

  return (
    <InfoBox
      title={<span className="inline-flex items-center gap-1">Next high score forecast <PreviewTag /></span>}
      info={<div>
        <div className="mb-2">Estimates when you are likely to beat your current personal best for the selected scenario.
          The model focuses on runs, not hours, and computes an optimal pause between runs for fastest progress.
        </div>
        <ul className="list-disc pl-5 text-[var(--text-secondary)]">
          <li>Recent runs matter more.</li>
          <li>Optimal pause is learned from your data; it is not a historical average.</li>
          <li>Confidence reflects fit quality (R²), sample size, and recency.</li>
        </ul>
      </div>}
      height={114}
    >
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: ETA + inline badge */}
        <div className="min-w-0">
          <div className="text-[var(--text-secondary)] text-xs">ETA to next high score</div>
          <div className="mt-0.5 flex items-center gap-2 text-base md:text-lg font-medium leading-tight min-w-0 text-[var(--text-primary)]">
            {pred.runsExpected ? (
              <>
                <span className="truncate">~{pred.runsLo ?? pred.runsExpected}–{pred.runsHi ?? pred.runsExpected} runs</span>
                {pred.optPauseHours != null && (
                  <span className="text-xs text-[var(--text-secondary)]">avg pause ~{Math.max(1, Math.round(pred.optPauseHours * 60))}m</span>
                )}
                <span className="hidden md:inline text-xs text-[var(--text-secondary)]">(≈ {pred.etaHuman})</span>
              </>
            ) : pred.etaTs ? (
              <span className="truncate">~{pred.etaHuman}</span>
            ) : (
              <span className="text-[var(--text-secondary)] truncate">{pred.reason ?? 'Unknown'}</span>
            )}
            {badge(pred.confidence)}
          </div>
        </div>
        {/* Right: concise stats grid (sits to the right on md+, wraps below on small) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs shrink-0">
          <div className="min-w-0">
            <div className="text-[var(--text-secondary)]">Best</div>
            <div className="font-medium truncate text-[var(--text-primary)]">{Math.round(pred.best)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[var(--text-secondary)]">Last</div>
            <div className="font-medium truncate text-[var(--text-primary)]">{Math.round(pred.lastScore)} <span className="text-[var(--text-secondary)]">({pred.lastPlayedDays.toFixed(1)}d)</span></div>
          </div>
          <div className="min-w-0">
            <div className="text-[var(--text-secondary)]">Trend</div>
            <div className="font-medium truncate text-[var(--text-primary)]">{pred.slopePerRun.toFixed(2)}/run</div>
          </div>
          <div className="min-w-0">
            <div className="text-[var(--text-secondary)]">Sample</div>
            <div className="font-medium truncate text-[var(--text-primary)]">{pred.sample}</div>
          </div>
        </div>
      </div>
    </InfoBox>
  )
}

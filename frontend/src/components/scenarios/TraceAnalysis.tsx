import { Copy } from 'lucide-react'
import { Button } from '..'
import type { KillAnalysis, MouseTraceAnalysis, SensSuggestion } from '../../lib/analysis/mouse'
import { computeSuggestedSens } from '../../lib/analysis/mouse'
import { CHART_DECIMALS, formatNumber, formatPct, formatSeconds } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'
import { InfoBox } from '../shared/InfoBox'
import { PreviewTag } from '../shared/PreviewTag'

function SuggestedHeader({ suggestion }: { suggestion: NonNullable<SensSuggestion> }) {
  const text = formatNumber(suggestion.recommended, CHART_DECIMALS.sensTooltip)
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (e) {
      try {
        window.prompt('Copy suggested sensitivity (cm/360)', text)
      } catch (_) { }
    }
  }

  // Severity badge color
  const severityColor = suggestion.severity === 'severe' ? 'text-rose-400'
    : suggestion.severity === 'moderate' ? 'text-amber-400'
      : 'text-blue-400'

  return (
    <div className="flex items-baseline justify-between">
      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span>Suggested: {formatNumber(suggestion.recommended, CHART_DECIMALS.sensTooltip)} cm/360 <span className="text-[var(--text-secondary)]">({suggestion.changePct >= 0 ? '+' : ''}{formatPct(suggestion.changePct, CHART_DECIMALS.pctTooltip)})</span></span>
        <Button variant="ghost" size="sm" onClick={doCopy} title={`Copy ${text} cm/360`} aria-label={`Copy suggested sensitivity ${text} cm/360`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-xs flex items-center gap-2">
        <span className={`${severityColor} capitalize`}>{suggestion.severity} {suggestion.primaryIssue}</span>
        <span className="text-[var(--text-secondary)]">• Current: {formatNumber(suggestion.current, CHART_DECIMALS.sensTooltip)} cm/360</span>
      </div>
    </div>
  )
}



type TraceAnalysisProps = {
  item: ScenarioRecord
  analysis?: MouseTraceAnalysis | null
  onSelect?: (sel: { startMs: number; endMs: number; killMs: number; classification: 'optimal' | 'overshoot' | 'undershoot' }) => void
}

export function TraceAnalysis({
  item,
  analysis: propAnalysis,
  onSelect
}: TraceAnalysisProps) {
  const analysis: MouseTraceAnalysis | null = propAnalysis ?? null
  if (!analysis) return null

  const shown = analysis.kills
  const total = shown.length

  const fmtPct = (n: number) => total ? formatPct(n / total, CHART_DECIMALS.pctTooltip) : formatPct(0, CHART_DECIMALS.pctTooltip)

  // Produce a subtle background gradient that blends the issue color with 'optimal'
  const getPillStyle = (k: KillAnalysis) => {
    const base = 'px-2 py-0.5 rounded text-xs border flex items-center gap-1'
    const optimalBase = '16,185,129' // emerald-500
    if (k.classification === 'overshoot') {
      const primaryBase = '244,63,94' // rose-500
      const sev = k.overshootSeverity || 'moderate'
      const pct = sev === 'severe' ? 80 : sev === 'moderate' ? 55 : 25
      const bg = `linear-gradient(90deg, rgba(${primaryBase},0.16) 0%, rgba(${primaryBase},0.16) ${pct}%, rgba(${optimalBase},0.06) ${pct}%, rgba(${optimalBase},0.06) 100%)`
      const cls = sev === 'severe' ? 'text-rose-200 border-rose-500/60'
        : sev === 'moderate' ? 'text-rose-300 border-rose-500/40'
          : 'text-rose-400 border-rose-500/30'
      return { style: { background: bg }, classes: `${base} ${cls}` }
    }
    if (k.classification === 'undershoot') {
      const primaryBase = '245,158,11' // amber-500
      const sev = k.undershootSeverity || 'moderate'
      const pct = sev === 'severe' ? 80 : sev === 'moderate' ? 55 : 25
      const bg = `linear-gradient(90deg, rgba(${primaryBase},0.16) 0%, rgba(${primaryBase},0.16) ${pct}%, rgba(${optimalBase},0.06) ${pct}%, rgba(${optimalBase},0.06) 100%)`
      const cls = sev === 'severe' ? 'text-amber-200 border-amber-500/60'
        : sev === 'moderate' ? 'text-amber-300 border-amber-500/40'
          : 'text-amber-400 border-amber-500/30'
      return { style: { background: bg }, classes: `${base} ${cls}` }
    }
    // Optimal
    return { style: undefined, classes: `${base} bg-emerald-500/20 text-emerald-300 border-emerald-500/40` }
  }

  const pill = (k: KillAnalysis) => {
    const s = getPillStyle(k)
    return <span className={`${s.classes}`} style={s.style}>{k.classification === 'optimal' ? 'Optimal' : (k.classification === 'overshoot' ? 'Overshoot' : 'Undershoot')}</span>
  }

  const colorFor = (cls: KillAnalysis['classification']) => cls === 'overshoot' ? 'rgba(244,63,94,0.9)'
    : cls === 'undershoot' ? 'rgba(245,158,11,0.9)'
      : 'rgba(16,185,129,0.9)'

  const suggestion = computeSuggestedSens(analysis, item.stats)

  const infoContent = (
    <div>
      <div className="mb-2">Classifies each kill's approach path as overshoot, undershoot, or optimal by analyzing mouse movement patterns. Severity grades (slight/moderate/severe) indicate how many pixels past or short of target.</div>
      <ul className="list-disc pl-5 text-[var(--text-secondary)]">
        <li>Analysis window: ~{analysis.windowCapSec}s per kill</li>
        <li>Overshoot: cursor went past target and had to correct back. Severity based on pixels overshot.</li>
        <li>Undershoot: stopped short and made micro-corrections. Severity based on correction pattern.</li>
        <li>Avg overshoot: {formatNumber(analysis.avgOvershootPixels, 1)}px • Avg undershoot: {formatNumber(analysis.avgUndershootPixels, 1)}px</li>
        <li>Sensitivity suggestions focus on magnitude (how far off) rather than just count of issues.</li>
      </ul>
    </div>
  )  // Summary with severity breakdown
  const severitySummary = (type: 'overshoot' | 'undershoot') => {
    const counts = analysis.severityCounts[type]
    const parts = []
    if (counts.severe > 0) parts.push(`${counts.severe} severe`)
    if (counts.moderate > 0) parts.push(`${counts.moderate} moderate`)
    if (counts.slight > 0) parts.push(`${counts.slight} slight`)
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }

  return (
    <InfoBox
      title={<span className="inline-flex items-center gap-1">Mouse path analysis <PreviewTag /></span>}
      id="scenarios:mouse-path-analysis"
      info={infoContent}
      height={420}
    >
      <div className="flex flex-col md:flex-row gap-3 justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm">Summary:</div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30" title={severitySummary('overshoot')}>
              Overshoot {analysis.counts.overshoot} ({fmtPct(analysis.counts.overshoot)})
              {analysis.avgOvershootPixels > 0 && <span className="ml-1 opacity-70">~{formatNumber(analysis.avgOvershootPixels, 0)}px</span>}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30" title={severitySummary('undershoot')}>
              Undershoot {analysis.counts.undershoot} ({fmtPct(analysis.counts.undershoot)})
              {analysis.avgUndershootPixels > 0 && <span className="ml-1 opacity-70">~{formatNumber(analysis.avgUndershootPixels, 0)}px</span>}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Optimal {analysis.counts.optimal} ({fmtPct(analysis.counts.optimal)})</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Efficiency <span className="text-[var(--text-primary)] font-semibold">{formatPct(analysis.avgEfficiency)}</span>
          </div>
        </div>
      </div>
      {suggestion ? (
        <div className="mt-3">
          <div className="p-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-sm">
            <SuggestedHeader suggestion={suggestion} />
            <div className="mt-1 text-[var(--text-secondary)] text-xs">{suggestion.reason}</div>
            <div className="mt-2 text-[var(--text-secondary)] text-xs">Try 3-10 runs at the suggested sensitivity to adapt, then revert to your original sensitivity and check whether overshoot/undershoot is reduced.</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 p-3 bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] border-dashed rounded text-sm text-[var(--text-secondary)]">
          <div className="font-medium text-[var(--text-primary)] mb-1">Sensitivity Suggestion Unavailable</div>
          <p className="text-xs leading-relaxed">
            Not enough actionable data to calculate a reliable sensitivity suggestion. This can happen when: aim is already optimal, issues are mixed (both over and undershoot), or the scenario type (e.g., pure tracking) lacks distinct flick patterns.
          </p>
        </div>
      )}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {shown.map((k, i) => (
          <button key={`${k.killIdx}-${i}`} onClick={() => onSelect?.({ startMs: k.startMs, endMs: k.endMs, killMs: k.endMs, classification: k.classification })} className="text-left bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-[var(--border-primary)] rounded p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[var(--text-primary)] font-medium">#{k.killIdx}</div>
              {pill(k)}
            </div>
            <div className="mt-1 text-[var(--text-secondary)] text-xs flex items-center justify-between">
              <div>TTK {formatSeconds(k.stats.ttkSec || 0, CHART_DECIMALS.ttkTooltip)}</div>
              <div>
                {k.classification === 'overshoot' && k.overshootPixels > 0 && (
                  <span className="text-rose-400">{formatNumber(k.overshootPixels, 0)}px over</span>
                )}
                {k.classification === 'undershoot' && k.undershootPixels > 0 && (
                  <span className="text-amber-400">{formatNumber(k.undershootPixels, 0)}px short</span>
                )}
                {k.classification === 'optimal' && (
                  <span className="text-emerald-400">direct</span>
                )}
              </div>
              <div className="text-[var(--text-primary)]" style={{ color: colorFor(k.classification) }}>{formatPct(k.efficiency, CHART_DECIMALS.pctTooltip)}</div>
            </div>
          </button>
        ))}
      </div>
    </InfoBox>
  )
}

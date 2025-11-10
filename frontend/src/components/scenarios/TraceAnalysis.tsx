import { Copy } from 'lucide-react'
import { Button } from '..'
import type { KillAnalysis, MouseTraceAnalysis, SensSuggestion } from '../../lib/analysis/mouse'
import { computeSuggestedSens } from '../../lib/analysis/mouse'
import type { ScenarioRecord } from '../../types/ipc'
import { InfoBox } from '../shared/InfoBox'
import { PreviewTag } from '../shared/PreviewTag'

function SuggestedHeader({ suggestion }: { suggestion: NonNullable<SensSuggestion> }) {
  const text = suggestion.recommended.toFixed(2)
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (e) {
      try {
        window.prompt('Copy suggested sensitivity (cm/360)', text)
      } catch (_) { }
    }
  }
  return (
    <div className="flex items-baseline justify-between">
      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span>Suggested: {suggestion.recommended.toFixed(2)} cm/360 <span className="text-[var(--text-secondary)]">({suggestion.changePct >= 0 ? '+' : ''}{suggestion.changePct.toFixed(0)}%)</span></span>
        <Button variant="ghost" size="sm" onClick={doCopy} title={`Copy ${text} cm/360`} aria-label={`Copy suggested sensitivity ${text} cm/360`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-xs text-[var(--text-secondary)]">Current: {suggestion.current.toFixed(2)} cm/360</div>
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

  const fmtPct = (n: number) => total ? ((n / total) * 100).toFixed(0) + '%' : '0%'

  const pill = (cls: KillAnalysis['classification']) => {
    const base = 'px-2 py-0.5 rounded text-xs border'
    if (cls === 'overshoot') return <span className={`${base} bg-rose-500/20 text-rose-300 border-rose-500/40`}>Overshoot</span>
    if (cls === 'undershoot') return <span className={`${base} bg-amber-500/20 text-amber-300 border-amber-500/40`}>Undershoot</span>
    return <span className={`${base} bg-emerald-500/20 text-emerald-300 border-emerald-500/40`}>Optimal</span>
  }

  const colorFor = (cls: KillAnalysis['classification']) => cls === 'overshoot' ? 'rgba(244,63,94,0.9)'
    : cls === 'undershoot' ? 'rgba(245,158,11,0.9)'
      : 'rgba(16,185,129,0.9)'

  // Suggestion is computed in the analysis module

  const suggestion = computeSuggestedSens(analysis, item.stats)

  return (
    <InfoBox
      title={<span className="inline-flex items-center gap-1">Mouse path analysis <PreviewTag /></span>}
      info={<div>
        <div className="mb-2">Classifies each kill's approach path as overshoot, undershoot, or optimal by aligning kill events to your mouse trace and inspecting the final approach window.</div>
        <ul className="list-disc pl-5 text-[var(--text-secondary)]">
          <li>Windows are capped at ~{analysis.windowCapSec}s per kill to handle tracking scenarios.</li>
          <li>Overshoot: crossed the aim point, moved away, then returned at kill.</li>
          <li>Undershoot: multiple micro-corrections near the target without crossing.</li>
          <li>Optimality uses path efficiency (straight distance vs travelled path).</li>
        </ul>
      </div>}
      height={420}
    >
      <div className="flex flex-col md:flex-row gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm">Summary:</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">Overshoot {analysis.counts.overshoot} ({fmtPct(analysis.counts.overshoot)})</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Undershoot {analysis.counts.undershoot} ({fmtPct(analysis.counts.undershoot)})</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Optimal {analysis.counts.optimal} ({fmtPct(analysis.counts.optimal)})</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Avg efficiency <span className="text-[var(--text-primary)] font-semibold">{(analysis.avgEfficiency * 100).toFixed(1)}%</span></div>
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
      ) : null}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {shown.map((k, i) => (
          <button key={`${k.killIdx}-${i}`} onClick={() => onSelect?.({ startMs: k.startMs, endMs: k.endMs, killMs: k.endMs, classification: k.classification })} className="text-left bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 border border-[var(--border-primary)] rounded p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[var(--text-primary)] font-medium">#{k.killIdx}</div>
              {pill(k.classification)}
            </div>
            <div className="mt-1 text-[var(--text-secondary)] text-xs flex items-center justify-between">
              <div>TTK {(k.stats.ttkSec || 0).toFixed(3)}s</div>
              <div>Shots {Math.round(k.stats.shots)}, Hits {Math.round(k.stats.hits)}</div>
              <div className="text-[var(--text-primary)]" style={{ color: colorFor(k.classification) }}>{(k.efficiency * 100).toFixed(0)}%</div>
            </div>
          </button>
        ))}
      </div>
    </InfoBox>
  )
}

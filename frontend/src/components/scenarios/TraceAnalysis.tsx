import { Copy } from 'lucide-react'
import { useMemo } from 'react'
import { useChartTheme } from '../../hooks/useChartTheme'
import type { KillAnalysis, MouseTraceAnalysis, SensSuggestion } from '../../lib/analysis/mouse'
import { computeSuggestedSens } from '../../lib/analysis/mouse'
import { CHART_DECIMALS } from '../../lib/constants'
import { colorWithAlpha } from '../../lib/theme'
import { formatNumber, formatPct, formatSeconds } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'
import { Button } from '../shared/Button'
import { InfoBox } from '../shared/InfoBox'

function SuggestedHeader({ suggestion, severityColors }: { suggestion: NonNullable<SensSuggestion>, severityColors: Record<'severe' | 'moderate' | 'slight', string> }) {
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
  const severityColor = suggestion.severity === 'severe'
    ? severityColors.severe
    : suggestion.severity === 'moderate'
      ? severityColors.moderate
      : severityColors.slight

  return (
    <div className="flex items-baseline justify-between">
      <div className="font-semibold text-primary flex items-center gap-2">
        <span>Suggested: {formatNumber(suggestion.recommended, CHART_DECIMALS.sensTooltip)} cm/360 <span className="text-secondary">({suggestion.changePct >= 0 ? '+' : ''}{formatPct(suggestion.changePct, CHART_DECIMALS.pctTooltip)})</span></span>
        <Button variant="ghost" size="sm" onClick={doCopy} title={`Copy ${text} cm/360`} aria-label={`Copy suggested sensitivity ${text} cm/360`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-xs flex items-center gap-2">
        <span className="capitalize" style={{ color: severityColor }}>{suggestion.severity} {suggestion.primaryIssue}</span>
        <span className="text-secondary">• Current: {formatNumber(suggestion.current, CHART_DECIMALS.sensTooltip)} cm/360</span>
      </div>
    </div>
  )
}


type TraceAnalysisProps = {
  item: ScenarioRecord
  analysis?: MouseTraceAnalysis | null
  onSelect?: (sel: { startMs: number; endMs: number; killMs: number; classification: 'optimal' | 'overshoot' | 'undershoot' }) => void
  height?: number | string
  isSidebar?: boolean
}

export function TraceAnalysis({
  item,
  analysis: propAnalysis,
  onSelect,
  height = 420,
  isSidebar = false
}: TraceAnalysisProps) {
  const analysis: MouseTraceAnalysis | null = propAnalysis ?? null
  if (!analysis) return null

  const shown = analysis.kills
  const total = shown.length

  const palette = useChartTheme()
  const overshootBase = palette.danger
  const undershootBase = palette.warning
  const optimalBase = palette.success

  const colors = useMemo(() => {
    const overshootSoft = colorWithAlpha(overshootBase, 0.16, 'rgba(244,63,94,0.16)')
    const undershootSoft = colorWithAlpha(undershootBase, 0.16, 'rgba(245,158,11,0.16)')
    const optimalSoft = colorWithAlpha(optimalBase, 0.06, 'rgba(16,185,129,0.06)')

    const overshootBg = colorWithAlpha(overshootBase, 0.15, 'rgba(244,63,94,0.15)')
    const overshootBorder = colorWithAlpha(overshootBase, 0.35, 'rgba(244,63,94,0.35)')
    const overshootText = colorWithAlpha(overshootBase, 0.95, 'rgba(244,63,94,0.95)')

    const undershootBg = colorWithAlpha(undershootBase, 0.15, 'rgba(245,158,11,0.15)')
    const undershootBorder = colorWithAlpha(undershootBase, 0.35, 'rgba(245,158,11,0.35)')
    const undershootText = colorWithAlpha(undershootBase, 0.95, 'rgba(245,158,11,0.95)')

    const optimalBg = colorWithAlpha(optimalBase, 0.2, 'rgba(16,185,129,0.2)')
    const optimalBorder = colorWithAlpha(optimalBase, 0.4, 'rgba(16,185,129,0.4)')
    const optimalText = colorWithAlpha(optimalBase, 0.95, 'rgba(16,185,129,0.95)')

    return {
      overshoot: { base: overshootBase, soft: overshootSoft, bg: overshootBg, border: overshootBorder, text: overshootText },
      undershoot: { base: undershootBase, soft: undershootSoft, bg: undershootBg, border: undershootBorder, text: undershootText },
      optimal: { base: optimalBase, soft: optimalSoft, bg: optimalBg, border: optimalBorder, text: optimalText },
      accent: colorWithAlpha(palette.accent, 0.9, 'rgba(59,130,246,0.9)'),
    }
  }, [overshootBase, undershootBase, optimalBase, palette.accent])

  const severityColors = useMemo(() => ({
    severe: colorWithAlpha(overshootBase, 0.9, 'rgba(244,63,94,0.9)'),
    moderate: colorWithAlpha(undershootBase, 0.9, 'rgba(245,158,11,0.9)'),
    slight: colors.accent,
  }), [colors.accent, overshootBase, undershootBase])

  const fmtPct = (n: number) => total ? formatPct(n / total, CHART_DECIMALS.pctTooltip) : formatPct(0, CHART_DECIMALS.pctTooltip)

  // Produce a subtle background gradient that blends the issue color with 'optimal'
  const getPillStyle = (k: KillAnalysis) => {
    const base = 'px-2 py-0.5 rounded text-xs border flex items-center gap-1'
    if (k.classification === 'overshoot') {
      const sev = k.overshootSeverity || 'moderate'
      const pct = sev === 'severe' ? 80 : sev === 'moderate' ? 55 : 25
      const borderAlpha = sev === 'severe' ? 0.6 : sev === 'moderate' ? 0.45 : 0.32
      const textAlpha = sev === 'severe' ? 0.92 : sev === 'moderate' ? 0.88 : 0.82
      const bg = `linear-gradient(90deg, ${colors.overshoot.soft} 0%, ${colors.overshoot.soft} ${pct}%, ${colors.optimal.soft} ${pct}%, ${colors.optimal.soft} 100%)`
      return {
        style: {
          background: bg,
          borderColor: colorWithAlpha(colors.overshoot.base, borderAlpha, 'rgba(244,63,94,0.45)'),
          color: colorWithAlpha(colors.overshoot.base, textAlpha, 'rgba(244,63,94,0.88)'),
        },
        classes: base
      }
    }
    if (k.classification === 'undershoot') {
      const sev = k.undershootSeverity || 'moderate'
      const pct = sev === 'severe' ? 80 : sev === 'moderate' ? 55 : 25
      const borderAlpha = sev === 'severe' ? 0.6 : sev === 'moderate' ? 0.45 : 0.32
      const textAlpha = sev === 'severe' ? 0.92 : sev === 'moderate' ? 0.88 : 0.82
      const bg = `linear-gradient(90deg, ${colors.undershoot.soft} 0%, ${colors.undershoot.soft} ${pct}%, ${colors.optimal.soft} ${pct}%, ${colors.optimal.soft} 100%)`
      return {
        style: {
          background: bg,
          borderColor: colorWithAlpha(colors.undershoot.base, borderAlpha, 'rgba(245,158,11,0.45)'),
          color: colorWithAlpha(colors.undershoot.base, textAlpha, 'rgba(245,158,11,0.88)'),
        },
        classes: base
      }
    }
    // Optimal
    return {
      style: {
        background: colors.optimal.bg,
        borderColor: colors.optimal.border,
        color: colors.optimal.text,
      },
      classes: base
    }
  }

  const pill = (k: KillAnalysis) => {
    const s = getPillStyle(k)
    return <span className={`${s.classes}`} style={s.style}>{k.classification === 'optimal' ? 'Optimal' : (k.classification === 'overshoot' ? 'Overshoot' : 'Undershoot')}</span>
  }

  const efficiencyColor = useMemo(() => ({
    overshoot: colorWithAlpha(overshootBase, 0.9, 'rgba(244,63,94,0.9)'),
    undershoot: colorWithAlpha(undershootBase, 0.9, 'rgba(245,158,11,0.9)'),
    optimal: colorWithAlpha(optimalBase, 0.9, 'rgba(16,185,129,0.9)'),
  }), [optimalBase, overshootBase, undershootBase])

  const suggestion = computeSuggestedSens(analysis, item.stats)

  const infoContent = (
    <div>
      <div className="mb-2">Classifies each kill's approach path as overshoot, undershoot, or optimal by analyzing mouse movement patterns. Severity grades (slight/moderate/severe) indicate how many pixels past or short of target.</div>
      <ul className="list-disc pl-5 text-secondary">
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

  const gridClass = isSidebar
    ? 'grid-cols-1'
    : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'

  return (
    <InfoBox
      title={<span className="inline-flex items-center gap-1">Mouse path analysis</span>}
      id="scenarios:mouse-path-analysis"
      info={infoContent}
      height={height}
    >
      <div className="flex flex-col md:flex-row gap-3 justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm">Summary:</div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span
              className="px-2 py-0.5 rounded border"
              style={{ backgroundColor: colors.overshoot.bg, color: colors.overshoot.text, borderColor: colors.overshoot.border }}
              title={severitySummary('overshoot')}
            >
              Overshoot {analysis.counts.overshoot} ({fmtPct(analysis.counts.overshoot)})
              {analysis.avgOvershootPixels > 0 && <span className="ml-1 opacity-70">~{formatNumber(analysis.avgOvershootPixels, 0)}px</span>}
            </span>
            <span
              className="px-2 py-0.5 rounded border"
              style={{ backgroundColor: colors.undershoot.bg, color: colors.undershoot.text, borderColor: colors.undershoot.border }}
              title={severitySummary('undershoot')}
            >
              Undershoot {analysis.counts.undershoot} ({fmtPct(analysis.counts.undershoot)})
              {analysis.avgUndershootPixels > 0 && <span className="ml-1 opacity-70">~{formatNumber(analysis.avgUndershootPixels, 0)}px</span>}
            </span>
            <span
              className="px-2 py-0.5 rounded border"
              style={{ backgroundColor: colors.optimal.bg, color: colors.optimal.text, borderColor: colors.optimal.border }}
            >
              Optimal {analysis.counts.optimal} ({fmtPct(analysis.counts.optimal)})
            </span>
          </div>
          <div className="text-xs text-secondary flex gap-3 items-center">
            <span>Efficiency <span className="text-primary font-semibold">{formatPct(analysis.avgEfficiency)}</span></span>
            {analysis.cm360 && (
              <span title="Sensitivity (cm/360)">Sens <span className="text-primary font-semibold">{formatNumber(analysis.cm360, 1)}cm</span></span>
            )}
            {analysis.totalDistanceCm && (
              <span title="Total physical distance moved">Dist <span className="text-primary font-semibold">{formatNumber(analysis.totalDistanceCm / 100, 2)}m</span></span>
            )}
            {analysis.avgSpeedCmS && (
              <span title="Average mouse speed (while moving)">Avg Spd <span className="text-primary font-semibold">{formatNumber(analysis.avgSpeedCmS, 1)}cm/s</span></span>
            )}
            {analysis.peakSpeedCmS && (
              <span title="Peak mouse speed">Peak <span className="text-primary font-semibold">{formatNumber(analysis.peakSpeedCmS, 0)}cm/s</span></span>
            )}
            {analysis.avgFlickSpeedCmS && (
              <span title="Average peak speed during flicks">Flick <span className="text-primary font-semibold">{formatNumber(analysis.avgFlickSpeedCmS, 0)}cm/s</span></span>
            )}
            {analysis.maxAccelG && (
              <span title="Peak acceleration in G-force">Max G <span className="text-primary font-semibold">{formatNumber(analysis.maxAccelG, 1)}</span></span>
            )}
          </div>
        </div>
      </div>
      {suggestion ? (
        <div className="mt-3">
          <div className="p-2 bg-surface-3 border border-primary rounded text-sm">
            <SuggestedHeader suggestion={suggestion} severityColors={severityColors} />
            <div className="mt-1 text-secondary text-xs">{suggestion.reason}</div>
            <div className="mt-2 text-secondary text-xs">Try 3-10 runs at the suggested sensitivity to adapt, then revert to your original sensitivity and check whether overshoot/undershoot is reduced.</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 p-3 bg-surface-3/50 border border-primary border-dashed rounded text-sm text-secondary">
          <div className="font-medium text-primary mb-1">Sensitivity Suggestion Unavailable</div>
          <p className="text-xs leading-relaxed">
            Not enough actionable data to calculate a reliable sensitivity suggestion. This can happen when: aim is already optimal, issues are mixed (both over and undershoot), or the scenario type (e.g., pure tracking) lacks distinct flick patterns.
          </p>
        </div>
      )}
      <div className={`mt-2 grid gap-2 ${gridClass}`}>
        {shown.map((k, i) => (
          <button key={`${k.killIdx}-${i}`} onClick={() => onSelect?.({ startMs: k.startMs, endMs: k.endMs, killMs: k.endMs, classification: k.classification })} className="text-left bg-surface-3 hover:bg-surface-3/80 border border-primary rounded p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-primary font-medium">#{k.killIdx}</div>
              {pill(k)}
            </div>
            <div className="mt-1 text-secondary text-xs flex items-center justify-between">
              <div>TTK {formatSeconds(k.stats.ttkSec || 0, CHART_DECIMALS.ttkTooltip)}</div>
              <div>
                {k.classification === 'overshoot' && k.overshootPixels > 0 && (
                  <span style={{ color: colors.overshoot.text }}>{formatNumber(k.overshootPixels, 0)}px over</span>
                )}
                {k.classification === 'undershoot' && k.undershootPixels > 0 && (
                  <span style={{ color: colors.undershoot.text }}>{formatNumber(k.undershootPixels, 0)}px short</span>
                )}
                {k.classification === 'optimal' && (
                  <span style={{ color: colors.optimal.text }}>direct</span>
                )}
              </div>
              <div className="text-primary" style={{ color: efficiencyColor[k.classification] }}>{formatPct(k.efficiency, CHART_DECIMALS.pctTooltip)}</div>
            </div>
          </button>
        ))}
      </div>
    </InfoBox>
  )
}

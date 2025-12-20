import { useMemo } from 'react'
import { useChartTheme } from '../../hooks/useChartTheme'
import { buildScenarioProfiles, recommendSessionLength } from '../../lib/analysis/session'
import { colorWithAlpha } from '../../lib/theme'
import type { Session } from '../../types/domain'
import { InfoBox } from '../shared/InfoBox'

type SessionLengthRecommendationProps = {
  sessions: Session[]
}

export function SessionLengthRecommendation({ sessions }: SessionLengthRecommendationProps) {
  const profiles = useMemo(() => buildScenarioProfiles(sessions), [sessions])
  const recommendation = useMemo(
    () => recommendSessionLength(sessions, profiles),
    [sessions, profiles]
  )

  const { suggestedRuns, confidence, warmupRuns, peakPerformanceWindow, diminishingReturnsAt, sessionsAnalyzed, avgSessionLength, insights } = recommendation

  const confidenceLabel = {
    low: { text: 'Low confidence', color: 'var(--warning)' },
    medium: { text: 'Medium confidence', color: 'var(--accent-primary)' },
    high: { text: 'High confidence', color: 'var(--success)' },
  }[confidence]

  const infoContent = (
    <div className="space-y-2">
      <p>This recommendation is based on analyzing your historical session data to find patterns in performance.</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><b>Warm-up:</b> Runs where performance typically improves as you get into the flow.</li>
        <li><b>Peak zone:</b> The run range where you typically perform best.</li>
        <li><b>Diminishing returns:</b> Point after which additional runs show less benefit.</li>
      </ul>
      {insights.length > 0 && (
        <div className="pt-2 border-t border-primary">
          <div className="font-medium mb-1">Insights:</div>
          <ul className="list-disc pl-5 space-y-1">
            {insights.map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
        </div>
      )}
    </div>
  )

  // Not enough data state
  if (sessionsAnalyzed < 3) {
    return (
      <InfoBox
        title="Session length insights"
        info={<p>Play at least 3 sessions with 3+ runs each to get personalized recommendations based on your performance patterns.</p>}
        id="sessions:length-recommendation"
        height={88}
      >
        <div className="text-secondary">
          Play at least 3 sessions with 3+ runs each to get personalized recommendations.
          {sessionsAnalyzed > 0 && ` (${sessionsAnalyzed} qualifying session${sessionsAnalyzed !== 1 ? 's' : ''} so far)`}
        </div>
      </InfoBox>
    )
  }

  return (
    <InfoBox
      title="Session length insights"
      info={infoContent}
      id="sessions:length-recommendation"
      height={168}
    >
      <div className="space-y-3">
        {/* Main recommendation */}
        <div className="flex items-baseline gap-2">
          <span className="text-secondary">Suggested:</span>
          <span className="text-lg font-bold text-primary">~{suggestedRuns} runs</span>
          <span className="text-xs" style={{ color: confidenceLabel.color }}>({confidenceLabel.text})</span>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="text-muted">Warm-up:</span>{' '}
            <span className="text-primary">{warmupRuns} run{warmupRuns !== 1 ? 's' : ''}</span>
          </span>
          <span>
            <span className="text-muted">Peak zone:</span>{' '}
            <span className="text-primary">#{peakPerformanceWindow[0]}–{peakPerformanceWindow[1]}</span>
          </span>
          <span>
            <span className="text-muted">Diminishing at:</span>{' '}
            <span className="text-primary">#{diminishingReturnsAt}</span>
          </span>
          <span>
            <span className="text-muted">Based on:</span>{' '}
            <span className="text-primary">{sessionsAnalyzed} sessions (avg. {avgSessionLength} runs)</span>
          </span>
        </div>

        {/* Visual bar */}
        <SessionPhaseBar
          warmup={warmupRuns}
          peakStart={peakPerformanceWindow[0]}
          peakEnd={peakPerformanceWindow[1]}
          suggested={suggestedRuns}
          maxRuns={Math.max(suggestedRuns + 3, diminishingReturnsAt + 2, 15)}
        />
      </div>
    </InfoBox>
  )
}

function SessionPhaseBar({ warmup, peakStart, peakEnd, suggested, maxRuns }: {
  warmup: number
  peakStart: number
  peakEnd: number
  suggested: number
  maxRuns: number
}) {
  const palette = useChartTheme()
  const warmupColor = colorWithAlpha(palette.warning, 0.3, 'rgba(245,158,11,0.3)')
  const peakColor = colorWithAlpha(palette.success, 0.4, 'rgba(16,185,129,0.4)')
  const markerColor = palette.accent

  const toPercent = (n: number) => (n / maxRuns) * 100

  return (
    <div>
      {/* Bar */}
      <div className="relative h-2 rounded-full bg-surface-3 overflow-hidden">
        {/* Warm-up phase */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${toPercent(warmup)}%`, backgroundColor: warmupColor }}
        />
        {/* Peak phase */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${toPercent(peakStart - 1)}%`,
            width: `${toPercent(peakEnd - peakStart + 1)}%`,
            backgroundColor: peakColor,
          }}
        />
        {/* Suggested marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${toPercent(suggested)}%`, backgroundColor: markerColor }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: warmupColor }} />
          <span className="text-muted">Warm-up</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: peakColor }} />
          <span className="text-muted">Peak</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-0.5" style={{ backgroundColor: markerColor }} />
          <span className="text-muted">Suggested</span>
        </div>
        <span className="ml-auto text-muted">{maxRuns} runs</span>
      </div>
    </div>
  )
}

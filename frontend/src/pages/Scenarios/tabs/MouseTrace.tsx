import { useMemo, useState } from 'react';
import { TraceAnalysis, TraceViewer } from '../../../components';
import { computeMouseTraceAnalysis, type MouseTraceAnalysis } from '../../../lib/analysis/mouse';
import type { ScenarioRecord } from '../../../types/ipc';

type MouseTraceTabProps = { item: ScenarioRecord }

export function MouseTraceTab({ item }: MouseTraceTabProps) {
  const points = Array.isArray(item.mouseTrace) ? item.mouseTrace : []
  const [sel, setSel] = useState<{ startMs: number; endMs: number; killMs: number; classification: 'optimal' | 'overshoot' | 'undershoot' } | null>(null)
  const analysis: MouseTraceAnalysis | null = useMemo(() => computeMouseTraceAnalysis(item), [item])
  if (points.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)]">
        No mouse trace data is available for this scenario. To see aim path analysis here, enable Mouse Trace Capture in RefleK's settings and record a new session.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <TraceViewer
        points={points}
        stats={item.stats}
        highlight={sel ? { startTs: sel.startMs, endTs: sel.endMs, color: sel.classification === 'overshoot' ? 'rgba(244,63,94,0.9)' : sel.classification === 'undershoot' ? 'rgba(245,158,11,0.9)' : 'rgba(16,185,129,0.9)' } : undefined}
        markers={sel ? [
          { ts: sel.startMs, color: 'rgba(59,130,246,0.9)', radius: 3 },
          { ts: sel.killMs, color: 'rgba(255,255,255,0.95)', radius: 3 },
        ] : undefined}
        seekToTs={sel?.endMs}
        centerOnTs={sel?.endMs}
        onReset={() => setSel(null)}
      />
      <TraceAnalysis item={item} analysis={analysis} onSelect={setSel} />
    </div>
  )
}

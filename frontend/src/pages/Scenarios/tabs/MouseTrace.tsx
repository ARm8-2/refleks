import { useState } from 'react';
import { TraceAnalysisPreview } from '../../../components/scenarios/TraceAnalysisPreview';
import { TraceViewer } from '../../../components/scenarios/TraceViewer';
import type { Point } from '../../../types/domain';
import type { ScenarioRecord } from '../../../types/ipc';

export function MouseTraceTab({ item }: { item: ScenarioRecord }) {
  const points = Array.isArray(item.mouseTrace) ? (item.mouseTrace as Point[]) : []
  const [sel, setSel] = useState<{ startMs: number; endMs: number; killMs: number; classification: 'optimal' | 'overshoot' | 'undershoot' } | null>(null)
  if (points.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)]">
        No mouse data captured for this scenario. Enable it in Settings (Windows only), then run a scenario.
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
      <TraceAnalysisPreview item={item} onSelect={setSel} />
    </div>
  )
}

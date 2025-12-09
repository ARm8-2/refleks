import { useMemo, useState } from 'react';
import { TraceAnalysis, TraceViewer } from '../../../components';
import { Modal } from '../../../components/shared/Modal';
import { useChartTheme } from '../../../hooks/useChartTheme';
import { computeMouseTraceAnalysis, type MouseTraceAnalysis } from '../../../lib/analysis/mouse';
import type { ScenarioRecord } from '../../../types/ipc';

type MouseTraceTabProps = { item: ScenarioRecord }

export function MouseTraceTab({ item }: MouseTraceTabProps) {
  const points = Array.isArray(item.mouseTrace) ? item.mouseTrace : []
  const chart = useChartTheme()
  const [sel, setSel] = useState<{ startMs: number; endMs: number; killMs: number; classification: 'optimal' | 'overshoot' | 'undershoot' } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const analysis: MouseTraceAnalysis | null = useMemo(() => computeMouseTraceAnalysis(item), [item])

  if (points.length === 0) {
    return (
      <div className="text-sm text-secondary">
        No mouse trace data is available for this scenario. To see aim path analysis here, enable Mouse Trace Capture in RefleK's settings and record a new session.
      </div>
    )
  }

  const viewerProps = {
    points,
    stats: item.stats,
    highlight: sel ? {
      startTs: sel.startMs,
      endTs: sel.endMs,
      color: sel.classification === 'overshoot'
        ? chart.danger
        : sel.classification === 'undershoot'
          ? chart.warning
          : chart.success
    } : undefined,
    markers: sel ? [
      { ts: sel.startMs, color: chart.accent, radius: 3 },
      { ts: sel.killMs, color: chart.contrast, radius: 3 },
    ] : undefined,
    seekToTs: sel?.endMs,
    centerOnTs: sel?.endMs,
    onReset: () => setSel(null),
  }

  return (
    <div className="space-y-3">
      <TraceViewer {...viewerProps} onFullscreen={() => setIsFullscreen(true)} />
      <TraceAnalysis item={item} analysis={analysis} onSelect={setSel} />

      <Modal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title="Mouse Trace Analysis"
        width="95%"
        height="95%"
      >
        <div className="flex h-full gap-4 overflow-hidden p-4">
          <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
            <TraceViewer {...viewerProps} canvasHeight="h-full" />
          </div>
          <div className="w-[400px] flex-shrink-0 border-l border-secondary pl-4 h-full">
            <TraceAnalysis item={item} analysis={analysis} onSelect={setSel} height="100%" isSidebar />
          </div>
        </div>
      </Modal>
    </div>
  )
}

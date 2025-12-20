import { useEffect, useMemo, useState } from 'react';
import { TraceAnalysis } from '../../../components/scenarios/TraceAnalysis';
import { TraceViewer } from '../../../components/scenarios/TraceViewer';
import { Loading } from '../../../components/shared/Loading';
import { Modal } from '../../../components/shared/Modal';
import { useChartTheme } from '../../../hooks/useChartTheme';
import { computeMouseTraceAnalysis, type MouseTraceAnalysis } from '../../../lib/analysis/mouse';
import { getScenarioTrace } from '../../../lib/internal';
import { decodeTraceData } from '../../../lib/trace';
import type { MousePoint, ScenarioRecord } from '../../../types/ipc';

type MouseTraceTabProps = { item: ScenarioRecord }

export function MouseTraceTab({ item }: MouseTraceTabProps) {
  const [fetchedPoints, setFetchedPoints] = useState<MousePoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reset when item changes
    setFetchedPoints(null);

    // If we already have data in the record, no need to fetch
    if ((Array.isArray(item.mouseTrace) && item.mouseTrace.length > 0) || item.traceData) {
      return;
    }

    // If we have a trace on disk but no data loaded, fetch it
    if (item.hasTrace) {
      setLoading(true);
      getScenarioTrace(item.fileName)
        .then(data => {
          const pts = decodeTraceData(data);
          setFetchedPoints(pts);
          // Optionally update the item in place to cache it for this session?
          // item.traceData = data;
        })
        .catch(err => console.error("Failed to load trace:", err))
        .finally(() => setLoading(false));
    }
  }, [item.fileName, item.hasTrace, item.mouseTrace, item.traceData]);

  const points = useMemo(() => {
    if (fetchedPoints) return fetchedPoints;
    if (Array.isArray(item.mouseTrace) && item.mouseTrace.length > 0) {
      return item.mouseTrace;
    }
    if (item.traceData) {
      return decodeTraceData(item.traceData);
    }
    return [];
  }, [item.mouseTrace, item.traceData, fetchedPoints]);

  const chart = useChartTheme()
  const [sel, setSel] = useState<{ startMs: number; endMs: number; killMs: number; classification: 'optimal' | 'overshoot' | 'undershoot' } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // We need to re-compute analysis when points change (e.g. after fetch)
  const analysis: MouseTraceAnalysis | null = useMemo(() => {
    if (points.length === 0) return null;
    return computeMouseTraceAnalysis(item, points);
  }, [item, points]);

  if (loading) {
    return <Loading />;
  }

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

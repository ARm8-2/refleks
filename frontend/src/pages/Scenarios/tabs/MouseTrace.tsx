import type { ScenarioRecord } from '../../../types/ipc';
import { TraceViewer } from '../../../components/scenarios/TraceViewer';
import type { Point } from '../../../types/domain';

export function MouseTraceTab({ item }: { item: ScenarioRecord }) {
  const points = Array.isArray(item.mouseTrace) ? (item.mouseTrace as Point[]) : []
  if (points.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)]">
        No mouse data captured for this scenario. Enable it in Settings (Windows only), then run a scenario.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <TraceViewer points={points} stats={item.stats} />
    </div>
  )
}

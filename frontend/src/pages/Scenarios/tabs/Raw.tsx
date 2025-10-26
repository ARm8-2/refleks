import type { ScenarioRecord } from '../../../types/ipc'

export function RawTab({ item }: { item: ScenarioRecord }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="font-medium mb-1">Stats</div>
        <pre className="text-xs bg-[var(--bg-tertiary)] rounded p-2 overflow-auto max-h-60">{JSON.stringify(item.stats, null, 2)}</pre>
      </div>
      <div>
        <div className="font-medium mb-1">Events ({item.events.length})</div>
        <div className="text-xs text-[var(--text-secondary)]">First rows:</div>
        <pre className="text-xs bg-[var(--bg-tertiary)] rounded p-2 overflow-auto max-h-60">{item.events.slice(0, 10).map(r => r.join(',')).join('\n')}</pre>
      </div>
    </div>
  )
}

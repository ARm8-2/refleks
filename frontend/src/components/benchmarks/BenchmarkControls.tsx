import type { RankDef } from '../../types/ipc'
import { Button } from '../shared/Button'
import { Dropdown } from '../shared/Dropdown'
import { Toggle } from '../shared/Toggle'

type BenchmarkControlsProps = {
  rankDefs: RankDef[]
  autoHideCleared: boolean
  setAutoHideCleared: (v: boolean) => void
  visibleRankCount: number
  setVisibleRankCount: (v: number) => void
  manuallyHidden: Set<number>
  toggleManualRank: (idx: number) => void
  resetManual: () => void
  autoHidden: Set<number>
  embedded?: boolean
}

export function BenchmarkControls({
  rankDefs,
  autoHideCleared, setAutoHideCleared,
  visibleRankCount, setVisibleRankCount,
  manuallyHidden, toggleManualRank, resetManual,
  autoHidden,
  embedded
}: BenchmarkControlsProps) {
  const controls = (
    <div className="flex items-center gap-3">
      <Toggle
        size="sm"
        label="Auto-hide earlier ranks"
        checked={autoHideCleared}
        onChange={setAutoHideCleared}
      />
      <Dropdown
        size="sm"
        label="Keep columns visible"
        ariaLabel="Target number of visible rank columns"
        value={String(visibleRankCount)}
        onChange={v => setVisibleRankCount(Math.max(1, parseInt(v || '1', 10) || 1))}
        options={Array.from({ length: Math.max(9, rankDefs.length) }, (_, i) => i + 1).map(n => ({ label: String(n), value: String(n) }))}
      />
      <Button size="sm" variant="ghost" onClick={resetManual} title="Reset manual visibility">Reset</Button>
    </div>
  )

  const ranks = (
    <div className="flex flex-wrap gap-1">
      {rankDefs.map((r, i) => {
        const auto = autoHidden.has(i)
        const manualHidden = manuallyHidden.has(i)
        const visible = !(auto || manualHidden)
        return (
          <Button
            key={r.name + i}
            size="sm"
            variant={visible ? 'secondary' : 'ghost'}
            onClick={() => toggleManualRank(i)}
            disabled={auto}
            className={`${auto ? 'opacity-60 cursor-not-allowed' : ''} ${r.color ? '' : 'text-secondary'}`}
            title={auto ? 'Hidden automatically (all scenarios are past this rank)' : (visible ? 'Click to hide this column' : 'Click to show this column')}
            style={r.color ? { color: r.color } : undefined}
          >
            {r.name}
          </Button>
        )
      })}
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 pb-4 border-b border-primary/20">
          {controls}
        </div>
        <div>
          <div className="text-xs text-secondary mb-2">Toggle columns to show/hide. Auto-hidden columns are disabled.</div>
          {ranks}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 rounded border border-primary mt-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary">
        <div className="text-sm font-medium text-primary">Rank columns</div>
        {controls}
      </div>
      <div className="p-3">
        <div className="text-xs text-secondary mb-2">Toggle columns to show/hide. Auto-hidden columns are disabled.</div>
        {ranks}
      </div>
    </div>
  )
}

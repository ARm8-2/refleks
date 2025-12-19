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
  showNotesCol: boolean
  setShowNotesCol: (v: boolean) => void
  showRecCol: boolean
  setShowRecCol: (v: boolean) => void
  showPlayCol: boolean
  setShowPlayCol: (v: boolean) => void
  showHistoryCol: boolean
  setShowHistoryCol: (v: boolean) => void
}

export function BenchmarkControls({
  rankDefs,
  autoHideCleared, setAutoHideCleared,
  visibleRankCount, setVisibleRankCount,
  manuallyHidden, toggleManualRank, resetManual,
  autoHidden,
  showNotesCol, setShowNotesCol,
  showRecCol, setShowRecCol,
  showPlayCol, setShowPlayCol,
  showHistoryCol, setShowHistoryCol
}: BenchmarkControlsProps) {
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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-primary">Feature Columns</h3>
        <div className="flex flex-wrap gap-4">
          <Toggle size="sm" label="Notes" checked={showNotesCol} onChange={setShowNotesCol} />
          <Toggle size="sm" label="Recommendations" checked={showRecCol} onChange={setShowRecCol} />
          <Toggle size="sm" label="Play Button" checked={showPlayCol} onChange={setShowPlayCol} />
          <Toggle size="sm" label="History" checked={showHistoryCol} onChange={setShowHistoryCol} />
        </div>
      </div>

      <div className="h-px bg-border-secondary" />

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-primary">Visibility Settings</h3>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            size="sm"
            label="Auto-hide earlier ranks"
            checked={autoHideCleared}
            onChange={setAutoHideCleared}
          />
          <div className="h-4 w-px bg-border-primary mx-2 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">Keep visible:</span>
            <Dropdown
              size="sm"
              ariaLabel="Target number of visible rank columns"
              value={String(visibleRankCount)}
              onChange={v => setVisibleRankCount(Math.max(1, parseInt(v || '1', 10) || 1))}
              options={Array.from({ length: Math.max(9, rankDefs.length) }, (_, i) => i + 1).map(n => ({ label: String(n), value: String(n) }))}
            />
          </div>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={resetManual} title="Reset manual visibility">Reset All</Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-primary">Rank Columns</h3>
        <p className="text-xs text-secondary">Click to manually show/hide columns. Auto-hidden columns are disabled.</p>
        <div>
          {ranks}
        </div>
      </div>
    </div>
  )
}

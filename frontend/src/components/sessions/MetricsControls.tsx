import { Dropdown } from '../shared/Dropdown';
import { SegmentedControl } from '../shared/SegmentedControl';
import { Toggle } from '../shared/Toggle';

export function MetricsControls({
  names,
  selectedName,
  onSelect,
  autoSelectLast,
  onToggleAuto,
  firstPct,
  lastPct,
  onFirstPct,
  onLastPct,
  mode = 'scenarios',
  onModeChange,
}: {
  names: string[]
  selectedName: string
  onSelect: (name: string) => void
  autoSelectLast: boolean
  onToggleAuto: (v: boolean) => void
  firstPct: number
  lastPct: number
  onFirstPct: (n: number) => void
  onLastPct: (n: number) => void
  mode?: 'scenarios' | 'sessions'
  onModeChange?: (m: 'scenarios' | 'sessions') => void
}) {
  const pctOptions = [20, 25, 30, 40, 50]
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Dropdown
        label="Scenario"
        value={selectedName}
        onChange={(v: string) => onSelect(v)}
        options={names.map(n => ({ label: n, value: n }))}
      />
      {onModeChange && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>View</span>
          <SegmentedControl
            options={[
              { label: 'Runs', value: 'scenarios' },
              { label: 'Sessions', value: 'sessions' },
            ]}
            value={mode}
            onChange={(v) => onModeChange(v as 'scenarios' | 'sessions')}
          />
        </div>
      )}
      <Toggle
        label="Auto"
        checked={autoSelectLast}
        onChange={(v: boolean) => onToggleAuto(v)}
      />
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span>Compare</span>
        <Dropdown
          value={firstPct}
          onChange={(v: string) => onFirstPct(Number(v))}
          options={pctOptions.map(p => ({ label: `${p}% first`, value: p }))}
        />
        <span>vs</span>
        <Dropdown
          value={lastPct}
          onChange={(v: string) => onLastPct(Number(v))}
          options={pctOptions.map(p => ({ label: `${p}% last`, value: p }))}
        />
      </div>
    </div>
  )
}

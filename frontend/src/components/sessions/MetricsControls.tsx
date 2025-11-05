import { SearchDropdown } from '../shared/SearchDropdown';
import { SegmentedControl } from '../shared/SegmentedControl';
import { Toggle } from '../shared/Toggle';

type MetricsControlsProps = {
  names: string[]
  selectedName: string
  onSelect: (name: string) => void
  autoSelectLast: boolean
  onToggleAuto: (v: boolean) => void
  mode?: 'scenarios' | 'sessions'
  onModeChange?: (m: 'scenarios' | 'sessions') => void
}

export function MetricsControls({
  names,
  selectedName,
  onSelect,
  autoSelectLast,
  onToggleAuto,
  mode = 'scenarios',
  onModeChange,
}: MetricsControlsProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <SearchDropdown
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
              { label: 'Scenarios', value: 'scenarios' },
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
      {/* compare controls moved to the summary header for clearer placement */}
    </div>
  )
}

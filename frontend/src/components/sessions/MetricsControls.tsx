
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
}) {
  const pctOptions = [20, 25, 30, 40, 50]
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span>Scenario</span>
        <select
          className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded px-2 py-1 border border-[var(--border-primary)]"
          value={selectedName}
          onChange={(e) => { onSelect(e.target.value) }}
        >
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] select-none">
        <input type="checkbox" className="accent-[var(--accent-primary)]" checked={autoSelectLast} onChange={e => onToggleAuto(e.target.checked)} />
        <span>Auto</span>
      </label>
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span>Compare</span>
        <select
          className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded px-2 py-1 border border-[var(--border-primary)]"
          value={firstPct}
          onChange={(e) => onFirstPct(Number(e.target.value))}
        >
          {pctOptions.map(p => <option key={`f-${p}`} value={p}>{p}% first</option>)}
        </select>
        <span>vs</span>
        <select
          className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded px-2 py-1 border border-[var(--border-primary)]"
          value={lastPct}
          onChange={(e) => onLastPct(Number(e.target.value))}
        >
          {pctOptions.map(p => <option key={`l-${p}`} value={p}>{p}% last</option>)}
        </select>
      </div>
    </div>
  )
}

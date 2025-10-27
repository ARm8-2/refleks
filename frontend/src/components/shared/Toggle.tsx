import { SegmentedControl } from './SegmentedControl'

export function Toggle({
  checked,
  onChange,
  label,
  size = 'sm',
  className = '',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={`inline-flex items-center gap-2 text-[var(--text-secondary)] ${size === 'md' ? 'text-sm' : 'text-xs'} ${className}`}>
      {label && <span className="select-none">{label}</span>}
      <SegmentedControl
        size={size}
        options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
        value={checked ? 'on' : 'off'}
        onChange={(v) => onChange(v === 'on')}
      />
    </div>
  )
}

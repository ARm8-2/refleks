
export type SegmentedOption<T extends string = string> = {
  label: string
  value: T
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'sm',
}: {
  options: Array<SegmentedOption<T>>
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const pad = size === 'md' ? 'px-3 py-1.5' : 'px-3 py-1'
  return (
    <div className={`inline-flex rounded overflow-hidden border border-[var(--border-primary)] bg-[var(--bg-secondary)] ${className}`} role="tablist" aria-orientation="horizontal">
      {options.map((opt, idx) => {
        const active = opt.value === value
        return (
          <button
            key={(opt.value as string) + ':' + idx}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${pad} text-xs ${active ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'} transition-colors`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

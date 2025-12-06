
export type SegmentedOption<T extends string = string> = {
  label: string
  value: T
}

type SegmentedControlProps<T extends string = string> = {
  options: Array<SegmentedOption<T>>
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'sm',
}: SegmentedControlProps<T>) {
  const pad = size === 'md' ? 'px-3 py-1.5' : 'px-3 py-1'
  return (
    <div className={`inline-flex rounded overflow-hidden border border-primary bg-surface-2 ${className}`} role="tablist" aria-orientation="horizontal">
      {options.map((opt, idx) => {
        const active = opt.value === value
        return (
          <button
            key={(opt.value as string) + ':' + idx}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${pad} text-xs ${active ? 'bg-surface-3 text-primary' : 'text-secondary hover:bg-surface-3'} transition-colors`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

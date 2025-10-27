
export type DropdownOption = { label: string; value: string | number }

export function Dropdown({
  value,
  onChange,
  options,
  label,
  className = '',
  size = 'sm',
  ariaLabel,
  fullWidth = false,
}: {
  value: string | number
  onChange: (v: string) => void
  options: DropdownOption[]
  label?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  fullWidth?: boolean
}) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'
  return (
    <label className={`inline-flex items-center gap-2 text-[var(--text-secondary)] ${size === 'md' ? 'text-sm' : 'text-xs'} ${fullWidth ? 'w-full' : ''}`}>
      {label && <span className="select-none">{label}</span>}
      <div className={`relative ${fullWidth ? 'flex-1' : ''}`}>
        <select
          aria-label={ariaLabel || label}
          className={`appearance-none ${pad} rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40 hover:bg-[var(--bg-secondary)] pr-8 ${fullWidth ? 'w-full' : ''} ${className}`}
          value={value as any}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </label>
  )
}

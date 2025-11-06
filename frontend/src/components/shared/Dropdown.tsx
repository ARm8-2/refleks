import { useEffect, useMemo, useRef, useState } from 'react';

export type DropdownOption = { label: string; value: string | number }

type DropdownProps = {
  value: string | number
  onChange: (v: string) => void
  options: DropdownOption[]
  label?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  fullWidth?: boolean
}

export function Dropdown({
  value,
  onChange,
  options,
  label,
  className = '',
  size = 'sm',
  ariaLabel,
  fullWidth = false,
}: DropdownProps) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const selectedLabel = useMemo(() => options.find(opt => String(opt.value) === String(value))?.label ?? '', [options, value])

  useEffect(() => {
    if (!isOpen) return
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [isOpen])

  return (
    <label className={`inline-flex items-center gap-2 text-[var(--text-secondary)] ${size === 'md' ? 'text-sm' : 'text-xs'} ${fullWidth ? 'w-full' : ''}`}>
      {label && <span className="select-none">{label}</span>}
      <div ref={dropdownRef} className={`relative ${fullWidth ? 'flex-1' : ''}`}>
        <button
          type="button"
          aria-label={ariaLabel || label}
          aria-expanded={isOpen}
          className={`flex items-center justify-between ${pad} rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40 hover:bg-[var(--bg-secondary)] w-full ${className}`}
          onClick={() => setIsOpen(v => !v)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsOpen(true)
              setTimeout(() => {
                const first = dropdownRef.current?.querySelector('li[role="option"]') as HTMLElement | null
                if (first) first.focus()
              }, 0)
            }
          }}
        >
          <span className="truncate">{selectedLabel || 'Select...'}</span>
          <svg
            className="ml-2 text-[var(--text-secondary)]"
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
        </button>

        {isOpen && (
          <div className={`absolute left-0 z-10 mt-1 ${fullWidth ? 'w-full' : 'min-w-[16rem]'} rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] shadow-lg`}>
            <ul role="listbox" className="max-h-72 overflow-auto">
              {options.length === 0 && (
                <li className="px-2 py-1 text-xs text-[var(--text-secondary)] select-none">No options</li>
              )}

              {options.map((opt, i) => (
                <li
                  key={String(opt.value)}
                  tabIndex={0}
                  role="option"
                  aria-selected={String(opt.value) === String(value)}
                  className={`px-2 py-1 text-xs cursor-pointer hover:bg-[var(--accent-hover)] focus:bg-[var(--accent-hover)] focus:text-white ${String(opt.value) === String(value) ? 'bg-[var(--accent-primary)] text-white' : ''}`}
                  onClick={() => {
                    onChange(String(opt.value))
                    setIsOpen(false)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onChange(String(opt.value))
                      setIsOpen(false)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null
                      if (next) next.focus()
                      else {
                        const first = dropdownRef.current?.querySelector('li[role="option"]') as HTMLElement | null
                        if (first) first.focus()
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null
                      if (prev) prev.focus()
                      else (dropdownRef.current?.querySelector('button') as HTMLButtonElement | null)?.focus()
                    } else if (e.key === 'Escape') {
                      setIsOpen(false)
                      e.preventDefault()
                    }
                  }}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </label>
  )
}

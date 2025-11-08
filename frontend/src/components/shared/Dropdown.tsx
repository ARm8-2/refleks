import { ChevronDown } from 'lucide-react';
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

  const selectedLabel = useMemo(
    () => options.find(opt => String(opt.value) === String(value))?.label ?? '',
    [options, value]
  )

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [isOpen])

  const openAndFocusFirst = () => {
    setIsOpen(true)
    // Focus first option after menu renders
    setTimeout(() => {
      const first = dropdownRef.current?.querySelector<HTMLLIElement>('li[role="option"]')
      first?.focus()
    }, 0)
  }

  const handleSelect = (val: string | number) => {
    onChange(String(val))
    setIsOpen(false)
  }

  return (
    <div
      className={`inline-flex items-center gap-2 text-[var(--text-secondary)] ${size === 'md' ? 'text-sm' : 'text-xs'} ${fullWidth ? 'w-full' : ''
        }`}
    >
      {label && <span className="select-none">{label}</span>}
      <div ref={dropdownRef} className={`relative ${fullWidth ? 'flex-1' : ''}`}>
        <button
          type="button"
          aria-label={ariaLabel || label}
          aria-expanded={isOpen}
          className={`flex items-center justify-between ${pad} rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/60 hover:bg-[var(--bg-tertiary)] w-full ${className}`}
          onClick={() => setIsOpen(v => !v)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openAndFocusFirst()
            }
          }}
        >
          <span className="truncate">{selectedLabel || 'Select...'}</span>
          <ChevronDown className="ml-2 h-4 w-4 text-[var(--text-muted)]" aria-hidden />
        </button>

        {isOpen && (
          <div
            className={`absolute left-0 z-10 mt-1 ${fullWidth ? 'w-full' : 'min-w-[12rem]'} rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-lg`}
          >
            <ul role="listbox" className="max-h-72 overflow-auto text-xs">
              {options.length === 0 && (
                <li className="px-2 py-1 text-[var(--text-secondary)] select-none">No options</li>
              )}
              {options.map(opt => {
                const isSelected = String(opt.value) === String(value)
                return (
                  <li
                    key={String(opt.value)}
                    tabIndex={0}
                    role="option"
                    aria-selected={isSelected}
                    className={`px-2 py-1 cursor-pointer outline-none ${isSelected
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)]'
                      }`}
                    onClick={() => handleSelect(opt.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelect(opt.value)
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault()
                          ; (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus()
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        const prev = e.currentTarget.previousElementSibling as HTMLElement | null
                        if (prev) prev.focus()
                        else
                          (dropdownRef.current?.querySelector('button') as HTMLButtonElement | null)?.focus()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setIsOpen(false)
                      }
                    }}
                  >
                    {opt.label}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

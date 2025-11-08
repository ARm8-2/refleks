import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type SearchDropdownOption = { label: string; value: string | number }

export function filterAndSortOptions(options: SearchDropdownOption[], search: string): SearchDropdownOption[] {
  if (search.trim() === '') {
    return [...options].sort((a, b) => a.label.localeCompare(b.label))
  }

  const searchLower = search.toLowerCase()
  const searchWords = searchLower.split(/\s+/).filter(Boolean)
  const endsWithSpace = search.endsWith(' ')

  const optionMeta = options.map(opt => ({
    opt,
    labelLower: opt.label.toLowerCase(),
    labelWords: opt.label.toLowerCase().split(/\s+/),
  }))

  function getScore(meta: { opt: SearchDropdownOption; labelLower: string; labelWords: string[] }): number {
    const allWordsPresent = searchWords.every((word, i) => {
      if (endsWithSpace && i === searchWords.length - 1) {
        return meta.labelWords.includes(word)
      }
      return meta.labelWords.some(w => w.includes(word))
    })
    if (!allWordsPresent) return -1

    if (meta.labelLower === searchLower) return 100
    if (meta.labelWords[0] === searchLower) return 90
    if (meta.labelWords.some(w => w === searchLower)) return 85
    if (meta.labelWords[0].startsWith(searchLower)) return 80
    if (meta.labelWords.some(w => w.startsWith(searchLower))) return 75
    if (meta.labelWords.some(w => w.includes(searchLower))) return 65
    return 60
  }

  return optionMeta
    .map(meta => ({ opt: meta.opt, score: getScore(meta) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.opt.label.localeCompare(b.opt.label)))
    .map(({ opt }) => opt)
}

type SearchDropdownProps = {
  value: string | number
  onChange: (v: string) => void
  options: SearchDropdownOption[]
  label?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  fullWidth?: boolean
}

export function SearchDropdown({
  value,
  onChange,
  options,
  label,
  className = '',
  size = 'sm',
  ariaLabel,
  fullWidth = false,
}: SearchDropdownProps) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'

  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selectedLabel = useMemo(
    () => options.find(opt => String(opt.value) === String(value))?.label ?? '',
    [options, value]
  )

  const filteredOptions = useMemo(
    () => filterAndSortOptions(options, search),
    [options, search]
  )

  // Focus search when opened, reset search when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      return
    }
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [isOpen])

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

  const openAndFocusSearch = () => {
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
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
              openAndFocusSearch()
            }
          }}
        >
          <span className="truncate">{selectedLabel || 'Select...'}</span>
          <ChevronDown className="ml-2 h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
        </button>

        {isOpen && (
          <div
            className={`absolute left-0 z-10 mt-1 ${fullWidth ? 'w-full' : 'min-w-[16rem]'} rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-lg`}
          >
            <input
              ref={inputRef}
              type="text"
              className={`mb-1 w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] ${pad} text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50`}
              placeholder="Search..."
              aria-label={`Search ${label || ''}`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'ArrowDown' || e.key === 'Tab') && filteredOptions.length > 0) {
                  e.preventDefault()
                  const first = dropdownRef.current?.querySelector<HTMLLIElement>('li[role="option"]')
                  first?.focus()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setIsOpen(false)
                }
              }}
            />

            <ul role="listbox" aria-label={label ?? 'options'} className="max-h-72 overflow-auto text-xs">
              {filteredOptions.length === 0 && (
                <li className="px-2 py-1 text-[var(--text-secondary)] select-none">No options</li>
              )}

              {filteredOptions.map(opt => {
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
                        else inputRef.current?.focus()
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

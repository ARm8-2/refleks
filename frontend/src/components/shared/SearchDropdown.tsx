import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

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
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [isOpen])

  // Update position
  useLayoutEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        const rect = dropdownRef.current?.getBoundingClientRect()
        if (rect) {
          setCoords({
            top: rect.bottom,
            left: rect.left,
            width: rect.width
          })
        }
      }
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    } else {
      setCoords(null)
    }
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
      className={`inline-flex items-center gap-2 text-secondary ${size === 'md' ? 'text-sm' : 'text-xs'} ${fullWidth ? 'w-full' : ''
        }`}
    >
      {label && <span className="select-none">{label}</span>}
      <div ref={dropdownRef} className={`relative ${fullWidth ? 'flex-1' : ''}`}>
        <button
          type="button"
          aria-label={ariaLabel || label}
          aria-expanded={isOpen}
          className={`flex items-center justify-between ${pad} rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-2 focus:ring-accent/60 hover:bg-surface-3 w-full ${className}`}
          onClick={() => setIsOpen(v => !v)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openAndFocusSearch()
            }
          }}
        >
          <span className="truncate">{selectedLabel || 'Select...'}</span>
          <ChevronDown className="ml-2 h-4 w-4 text-secondary" aria-hidden />
        </button>

        {isOpen && coords && createPortal(
          <div
            ref={menuRef}
            className={`fixed z-[60] mt-1 rounded bg-surface-2 border border-primary shadow-lg`}
            style={{
              top: coords.top,
              left: coords.left,
              width: fullWidth ? coords.width : 'auto',
              minWidth: fullWidth ? undefined : '16rem'
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className={`mb-1 w-full rounded border border-primary bg-surface-2 ${pad} text-primary focus:outline-none focus:ring-2 focus:ring-accent/50`}
              placeholder="Search..."
              aria-label={`Search ${label || ''}`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'ArrowDown' || e.key === 'Tab') && filteredOptions.length > 0) {
                  e.preventDefault()
                  const first = menuRef.current?.querySelector<HTMLLIElement>('li[role="option"]')
                  first?.focus()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setIsOpen(false)
                }
              }}
            />

            <ul role="listbox" aria-label={label ?? 'options'} className="max-h-72 overflow-auto text-xs">
              {filteredOptions.length === 0 && (
                <li className="px-2 py-1 text-secondary select-none">No options</li>
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
                      ? 'bg-accent text-on-accent'
                      : 'text-primary hover:bg-hover focus:bg-hover'
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
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}

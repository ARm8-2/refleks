import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  prefix?: string
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
  prefix,
}: DropdownProps) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  const selectedLabel = useMemo(
    () => options.find(opt => String(opt.value) === String(value))?.label ?? '',
    [options, value]
  )

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (e: MouseEvent) => {
      // Check if click is inside dropdown button OR inside the portal list
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
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

  const openAndFocusFirst = () => {
    setIsOpen(true)
    // Focus first option after menu renders
    setTimeout(() => {
      const first = listRef.current?.querySelector<HTMLLIElement>('li[role="option"]')
      first?.focus()
    }, 0)
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
              openAndFocusFirst()
            }
          }}
        >
          <span className="truncate">{prefix}{selectedLabel || 'Select...'}</span>
          <ChevronDown className="ml-2 h-4 w-4 text-secondary" aria-hidden />
        </button>

        {isOpen && coords && createPortal(
          <div
            className={`fixed z-[60] mt-1 rounded bg-surface-2 border border-primary shadow-lg`}
            style={{
              top: coords.top,
              left: coords.left,
              width: fullWidth ? coords.width : 'auto',
              minWidth: fullWidth ? undefined : '12rem'
            }}
          >
            <ul ref={listRef} role="listbox" className="max-h-72 overflow-auto text-xs">
              {options.length === 0 && (
                <li className="px-2 py-1 text-secondary select-none">No options</li>
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
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}

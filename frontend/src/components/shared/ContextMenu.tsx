import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuItem = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: y, left: x })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleScroll = () => onClose()
    const handleResize = () => onClose()

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [onClose])

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      let newTop = y
      let newLeft = x

      // Check right edge
      if (x + rect.width > window.innerWidth) {
        newLeft = window.innerWidth - rect.width - 8
      }
      // Check bottom edge
      if (y + rect.height > window.innerHeight) {
        newTop = window.innerHeight - rect.height - 8
      }

      setPosition({ top: newTop, left: newLeft })
    }
  }, [x, y])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[160px] bg-surface-2 border border-primary rounded shadow-lg py-1 text-sm"
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            if (!item.disabled) {
              item.onClick()
              onClose()
            }
          }}
          disabled={item.disabled}
          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-3 transition-colors ${item.danger ? 'text-red-400' : 'text-primary'
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

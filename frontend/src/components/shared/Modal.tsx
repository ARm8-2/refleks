import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  headerControls?: ReactNode
  width?: string | number
  height?: string | number
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  headerControls,
  width = '80%',
  height = '80%',
  className = '',
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
      // Focus the modal container for accessibility (Escape works immediately)
      setTimeout(() => containerRef.current?.focus(), 0)
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative bg-surface-2 rounded-lg border border-primary shadow-xl flex flex-col ${className}`}
        style={{ width, height, maxHeight: '95vh', maxWidth: '95vw' }}
        ref={containerRef}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary shrink-0 gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="text-lg font-medium text-primary truncate shrink">{title}</div>
            {headerControls && (
              <div className="flex items-center gap-2 shrink-0">
                {headerControls}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-3 text-secondary hover:text-primary transition-colors ml-4 shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

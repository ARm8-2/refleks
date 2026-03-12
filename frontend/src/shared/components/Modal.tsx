import { useRef, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

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
  width,
  height,
  className = '',
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        ref={contentRef}
        className={cn('rounded-xl border-0 bg-card p-5 shadow-2xl sm:rounded-xl', className)}
        onOpenAutoFocus={event => {
          event.preventDefault()
          requestAnimationFrame(() => {
            contentRef.current?.focus()
          })
        }}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          maxWidth: typeof width === 'number' ? `${width}px` : width || '95vw',
          height: height === 'auto' ? 'auto' : typeof height === 'number' ? `${height}px` : height,
          maxHeight: '95vh',
        }}
      >
        {(title || headerControls) && (
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 pr-7">
              {title && <DialogTitle className="truncate">{title}</DialogTitle>}
              {headerControls && (
                <div className="flex shrink-0 items-center gap-2">{headerControls}</div>
              )}
            </div>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}

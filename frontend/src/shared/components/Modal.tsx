import type { ReactNode } from 'react'
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
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        className={className}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          maxWidth: typeof width === 'number' ? `${width}px` : width || '95vw',
          height: height === 'auto' ? 'auto' : typeof height === 'number' ? `${height}px` : height,
          maxHeight: '95vh',
        }}
      >
        {(title || headerControls) && (
          <DialogHeader>
            <div className="flex items-center gap-4">
              {title && <DialogTitle>{title}</DialogTitle>}
              {headerControls && (
                <div className="flex items-center gap-2">{headerControls}</div>
              )}
            </div>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}

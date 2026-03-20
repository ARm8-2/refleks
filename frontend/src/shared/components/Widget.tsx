import { Maximize2 } from 'lucide-react'
import { type KeyboardEvent, type MouseEvent, type ReactNode, useState } from 'react'
import { cn } from '../lib/utils'
import { Modal } from './Modal'

type WidgetProps = {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  headerActions?: ReactNode
  modalHeaderActions?: ReactNode
  modalTitle?: ReactNode
  modalContent?: ReactNode
  modalWidth?: string | number
  modalHeight?: string | number
  modalClassName?: string
  modalContentClassName?: string
}

export function Widget({
  title,
  description,
  children,
  className,
  contentClassName,
  headerActions,
  modalHeaderActions,
  modalTitle,
  modalContent,
  modalWidth,
  modalHeight,
  modalClassName,
  modalContentClassName,
}: WidgetProps) {
  const [open, setOpen] = useState(false)
  const canExpand = Boolean(modalContent)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canExpand) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setOpen(true)
  }

  const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      <section
        className={cn(
          'flex flex-col rounded-xl bg-card p-5',
          canExpand && 'cursor-pointer transition-colors hover:bg-card-hover',
          className,
        )}
        onClick={canExpand ? () => setOpen(true) : undefined}
        onKeyDown={handleKeyDown}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerActions && (
              <div
                className="flex items-center gap-2"
                onClick={event => event.stopPropagation()}
                onKeyDown={event => event.stopPropagation()}
              >
                {headerActions}
              </div>
            )}

            {canExpand && (
              <button
                type="button"
                className="-my-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Open widget"
                aria-label="Open widget"
                onClick={handleExpandClick}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className={cn('flex-1 min-h-0', contentClassName)}>{children}</div>
      </section>

      {canExpand && (
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title={modalTitle ?? title}
          headerControls={modalHeaderActions ?? headerActions}
          width={modalWidth}
          height={modalHeight}
          className={cn('rounded-xl bg-card shadow-xl', modalClassName)}
        >
          <div className={cn('h-full min-h-0 overflow-auto px-6 pb-6', modalContentClassName)}>{modalContent}</div>
        </Modal>
      )}
    </>
  )
}

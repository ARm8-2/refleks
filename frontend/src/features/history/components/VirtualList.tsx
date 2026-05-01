import { useVirtualizer } from '@tanstack/react-virtual'
import type { ReactNode } from 'react'
import { useRef } from 'react'

type VirtualListProps<T> = {
  items: T[]
  estimateSize?: number
  gap?: number
  overscan?: number
  renderItem: (item: T, index: number) => ReactNode
  emptyContent?: ReactNode
  className?: string
}

export function VirtualList<T>({
  items,
  estimateSize = 52,
  gap = 4,
  overscan = 8,
  renderItem,
  emptyContent,
  className,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    gap,
    overscan,
  })

  if (items.length === 0 && emptyContent) {
    return (
      <div ref={scrollRef} className={className}>
        {emptyContent}
      </div>
    )
  }

  return (
    <div ref={scrollRef} className={className}>
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

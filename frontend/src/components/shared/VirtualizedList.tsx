import type { Key, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AutoSizer, CellMeasurer, CellMeasurerCache, List, type ListRowProps } from 'react-virtualized'

export type VirtualizedListProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  getKey?: (item: T, index: number) => Key
  rowHeight?: number
  isResizing?: boolean
}

export function VirtualizedList<T>({ items, renderItem, getKey, rowHeight, isResizing = false }: VirtualizedListProps<T>) {
  const listRef = useRef<List | null>(null)

  // Fixed height if provided, otherwise dynamic measurement cache
  const cache = useMemo(() => new CellMeasurerCache({ fixedWidth: true, defaultHeight: rowHeight ?? 56 }), [rowHeight])

  // When width changes, parent will re-render and AutoSizer will report new width.
  // react-virtualized handles re-layout. If using dynamic heights, clear cache on width change.
  const onResize = useCallback(() => {
    if (!rowHeight) {
      // Avoid expensive clear/recompute on every pixel while actively dragging
      if (isResizing) return
      cache.clearAll()
      if (listRef.current) listRef.current.recomputeRowHeights()
    }
  }, [cache, rowHeight, isResizing])

  // After dragging ends, do a single recompute to correct row heights
  const prevIsResizingRef = useRef(isResizing)
  useEffect(() => {
    const wasResizing = prevIsResizingRef.current
    prevIsResizingRef.current = isResizing
    if (!rowHeight && wasResizing && !isResizing) {
      const id = window.requestAnimationFrame(() => {
        cache.clearAll()
        if (listRef.current) listRef.current.recomputeRowHeights()
      })
      return () => window.cancelAnimationFrame(id)
    }
  }, [isResizing, rowHeight, cache])

  const rowRenderer = useCallback(({ index, key, parent, style }: ListRowProps) => {
    const child = renderItem(items[index], index)
    const rowKey = getKey ? getKey(items[index], index) : key
    return (
      <CellMeasurer cache={cache} columnIndex={0} rowIndex={index} parent={parent} key={rowKey}>
        {({ measure }) => (
          <div style={style} onLoad={measure} className="pb-2 first:pt-2">
            <div className="px-2">{child}</div>
          </div>
        )}
      </CellMeasurer>
    )
  }, [items, renderItem, getKey, cache])

  return (
    <AutoSizer onResize={onResize}>
      {({ width, height }) => (
        <List
          ref={ref => { listRef.current = ref }}
          width={width}
          height={height}
          rowCount={items.length}
          overscanRowCount={6}
          rowHeight={rowHeight ?? cache.rowHeight}
          deferredMeasurementCache={rowHeight ? undefined : cache}
          rowRenderer={rowRenderer}
          style={{ outline: 'none' }}
        />
      )}
    </AutoSizer>
  )
}

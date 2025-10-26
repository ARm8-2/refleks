import { ChevronLeft } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AutoSizer, CellMeasurer, CellMeasurerCache, List, type ListRowProps } from 'react-virtualized'
import { useUIState } from '../../store/ui'

type VirtualizedProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  getKey?: (item: T, index: number) => React.Key
  rowHeight?: number
  emptyPlaceholder?: React.ReactNode
}

type BaseProps = {
  detail: React.ReactNode
  title?: string
  initialWidth?: number // px
  minWidth?: number // px
  maxWidth?: number // px
  // Optional header rendered above the detail content (right pane)
  detailHeader?: React.ReactNode
}

type Props<T = any> = BaseProps & VirtualizedProps<T>

const HANDLE_W = 16 // px (Tailwind w-4)
const COLLAPSED_W = 48 // px width of the thin collapsed bar
const HEADER_H = 40 // px fallback header height used if we cannot measure

export function ListDetail<T = any>({
  items,
  renderItem,
  getKey,
  rowHeight,
  emptyPlaceholder,
  detail,
  title = 'Recent',
  initialWidth = 280,
  minWidth = 240,
  maxWidth = 640,
  detailHeader,
}: Props<T>) {
  const [width, setWidth] = useUIState<number>(`ListDetail:${title}:width`, initialWidth)
  // collapsed = user-intended collapsed state (pinned closed)
  const [collapsed, setCollapsed] = useUIState<boolean>(`ListDetail:${title}:collapsed`, false)
  // hoverOpen = temporary open state while hovering when collapsed
  const [hoverOpen, setHoverOpen] = useState(false)
  // isResizing = true while the user is actively dragging the resize handle
  const [isResizing, setIsResizing] = useState(false)
  const lastWidthRef = useRef(initialWidth)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(initialWidth)
  const hoverTimerRef = useRef<number | null>(null)
  const ignoreHoverUntilLeaveRef = useRef(false)

  // Refs to imperatively update widths during drag without re-rendering the list
  const sideContainerRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)

  const clampedWidth = useMemo(() => Math.max(minWidth, Math.min(maxWidth, width)), [width, minWidth, maxWidth])
  const isCollapsed = collapsed && !hoverOpen
  const isOpen = !isCollapsed
  const isPeekOpen = collapsed && hoverOpen
  const isExpanded = isOpen || isPeekOpen
  const containerWidth = isExpanded ? clampedWidth + HANDLE_W : COLLAPSED_W + HANDLE_W

  const clearHoverTimers = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const collapse = useCallback(() => {
    clearHoverTimers()
    setHoverOpen(false)
    setCollapsed(true)
    ignoreHoverUntilLeaveRef.current = true
  }, [clearHoverTimers, setCollapsed])

  const expand = useCallback(() => {
    clearHoverTimers()
    setHoverOpen(false)
    setCollapsed(false)
    ignoreHoverUntilLeaveRef.current = false
  }, [clearHoverTimers, setCollapsed])

  // Start/stop dragging (imperative width updates for responsiveness)
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (collapsed) return
    setIsResizing(true)
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = clampedWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { }
  }, [collapsed, clampedWidth])

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - startXRef.current
    let next = startWidthRef.current + dx
    next = Math.max(minWidth, Math.min(maxWidth, next))
    lastWidthRef.current = next
    // Imperatively update widths to avoid re-rendering the list while dragging
    if (sidebarRef.current) sidebarRef.current.style.width = `${next}px`
    if (sideContainerRef.current) sideContainerRef.current.style.width = `${next + HANDLE_W}px`
  }, [minWidth, maxWidth])

  const stopDragging = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    const finalWidth = Math.max(minWidth, Math.min(maxWidth, lastWidthRef.current))
    setWidth(finalWidth)
    setIsResizing(false)
  }, [minWidth, maxWidth, setWidth])

  // Attach global pointer listeners so drag is smooth across the window
  useEffect(() => {
    const move = (e: Event) => onPointerMove(e as PointerEvent)
    const up = () => stopDragging()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
  }, [onPointerMove, stopDragging])

  // Keep refs in sync with state-driven width changes (e.g. keyboard/dblclick)
  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.style.width = `${(isOpen || isPeekOpen) ? clampedWidth : COLLAPSED_W}px`
    if (sideContainerRef.current) sideContainerRef.current.style.width = `${containerWidth}px`
  }, [clampedWidth, containerWidth, isOpen, isPeekOpen])

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar area (container width shrinks to handle when collapsed) */}
      <div
        ref={sideContainerRef}
        className="relative h-full shrink-0"
        style={{ width: `${containerWidth}px` }}
        onPointerEnter={(e) => {
          if (!collapsed || ignoreHoverUntilLeaveRef.current) return
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const y = e.clientY - rect.top
          const headerH = headerRef.current?.offsetHeight ?? HEADER_H
          if (y > headerH) setHoverOpen(true)
        }}
        onPointerMove={(e) => {
          if (!collapsed || ignoreHoverUntilLeaveRef.current || hoverOpen) return
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const y = e.clientY - rect.top
          const headerH = headerRef.current?.offsetHeight ?? HEADER_H
          if (y > headerH) setHoverOpen(true)
        }}
        onPointerLeave={() => {
          if (collapsed) {
            clearHoverTimers()
            hoverTimerRef.current = window.setTimeout(() => setHoverOpen(false), 80)
            ignoreHoverUntilLeaveRef.current = false
          }
        }}
      >
        {/* Sidebar panel (absolute. In collapsed state, it shrinks to a thin bar that shows only the toggle button) */}
        <div
          ref={sidebarRef}
          aria-expanded={!isCollapsed}
          className={`absolute left-0 top-0 bottom-0 bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)] flex flex-col min-h-0 overflow-hidden ${isResizing ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
          style={{ width: `${isExpanded ? clampedWidth : COLLAPSED_W}px`, willChange: 'width' }}
        >
          {/* Header */}
          <div ref={headerRef} className={`flex items-center ${isExpanded ? 'justify-between px-3' : 'justify-center px-1'} py-2 border-b border-[var(--border-primary)] shrink-0`}>
            {isExpanded && (
              <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{title}</div>
            )}
            <button
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
              title={collapsed ? 'Expand' : 'Collapse'}
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              onClick={() => (collapsed ? expand() : collapse())}
            >
              <ChevronLeft size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* List content */}
          {isExpanded ? (
            <div className="pl-2 min-h-0 flex-1">
              <div className="h-full">
                {items.length === 0 ? (
                  emptyPlaceholder ?? <div className="text-sm text-[var(--text-secondary)]">No items.</div>
                ) : (
                  <VirtualizedList
                    items={items}
                    renderItem={renderItem}
                    getKey={getKey}
                    rowHeight={rowHeight}
                    isResizing={isResizing}
                  />
                )}
              </div>
            </div>
          ) : (
            // Collapsed: no list content
            <div className="flex-1" />
          )}
        </div>

        {/* Resizer handle (stays at the right edge of the side container) */}
        <div className="absolute inset-y-0 right-0 w-4">
          <div
            role="separator"
            aria-orientation="vertical"
            tabIndex={0}
            className="absolute inset-y-0 right-0 w-4 cursor-col-resize hover:bg-[var(--bg-tertiary)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--border-primary)]"
            onPointerDown={onPointerDown}
            title="Drag to resize"
            onDoubleClick={() => { if (!collapsed) { setWidth(initialWidth); lastWidthRef.current = initialWidth } else { expand() } }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (collapsed) return
                const delta = e.key === 'ArrowLeft' ? -16 : 16
                const next = Math.max(minWidth, Math.min(maxWidth, clampedWidth + delta))
                setWidth(next)
                lastWidthRef.current = next
                e.preventDefault()
              } else if (e.key === 'Enter' || e.key === ' ') {
                if (collapsed) expand(); else collapse()
                e.preventDefault()
              }
            }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--border-primary)]/60" />
          </div>
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)] overflow-y-auto min-h-0 flex flex-col">
        {detailHeader ? (
          <div className="px-3 py-2 border-b border-[var(--border-primary)] shrink-0">{detailHeader}</div>
        ) : null}
        <div className="p-3 flex-1 min-h-0 overflow-y-auto">
          {detail}
        </div>
      </div>
    </div>
  )
}

// Virtualized renderer for arbitrary item arrays using react-virtualized.
function VirtualizedList<T>({ items, renderItem, getKey, rowHeight, isResizing = false }: { items: T[]; renderItem: (item: T, index: number) => React.ReactNode; getKey?: (item: T, index: number) => React.Key; rowHeight?: number; isResizing?: boolean }) {
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
            <div className="pr-1">{child}</div>
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

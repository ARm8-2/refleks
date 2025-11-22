import { useEffect } from 'react'

export type DragScrollOptions = {
  // CSS selector to skip dragging when the initial event target matches (or is inside) this selector.
  // Common interactive elements should be excluded so clicks still work.
  skipSelector?: string
  // Axis to scroll on drag. Default: 'x'
  axis?: 'x' | 'y' | 'xy'
  // Pixel threshold to start the drag after pointermove (to allow clicks)
  threshold?: number
  // Whether drag-to-scroll is currently enabled
  enabled?: boolean
}

// Allows the user to click and hold the container, then drag to scroll horizontally/vertically.
// This is designed to be non-invasive: it will not start dragging if the initial pointerdown
// happens on common interactive elements like buttons/links/inputs, or on the resize handle.
export function useDragScroll(ref: React.RefObject<HTMLElement>, options: DragScrollOptions = {}) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (options.enabled === false) return

    const {
      skipSelector = 'button, a, input, textarea, select, [role="button"]',
      axis = 'x',
      threshold = 6,
    } = options

    let down = false
    let dragging = false
    let startX = 0
    let startY = 0
    let startScrollLeft = 0
    let startScrollTop = 0
    let pointerId: number | null = null

    const shouldSkip = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      // Skip if hitting interactive elements or resize handle (class: cursor-col-resize)
      try {
        if (target.closest(skipSelector)) return true
      } catch { /* invalid selector - fallback to no skip */ }
      if (target.closest('.cursor-col-resize')) return true
      return false
    }

    const onPointerDown = (e: PointerEvent) => {
      // only left button
      if (e.button !== 0) return
      if (shouldSkip(e.target)) return
      down = true
      dragging = false
      startX = e.clientX
      startY = e.clientY
      startScrollLeft = el.scrollLeft
      startScrollTop = el.scrollTop
      pointerId = e.pointerId
      try { el.setPointerCapture(pointerId) } catch { }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!dragging && Math.sqrt(dx * dx + dy * dy) < threshold) return
      dragging = true
      // prevent text selection during drag
      document.body.style.userSelect = 'none'
      el.style.cursor = 'grabbing'
      e.preventDefault()
      if (axis === 'x' || axis === 'xy') {
        el.scrollLeft = Math.max(0, startScrollLeft - dx)
      }
      if (axis === 'y' || axis === 'xy') {
        el.scrollTop = Math.max(0, startScrollTop - dy)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== pointerId) return
      down = false
      dragging = false
      pointerId = null
      document.body.style.userSelect = ''
      el.style.cursor = ''
      try { el.releasePointerCapture(e.pointerId) } catch { }
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.body.style.userSelect = ''
      try { if (pointerId != null) el.releasePointerCapture(pointerId) } catch { }
    }
  }, [ref, options.skipSelector, options.axis, options.threshold, options.enabled])
}

export default useDragScroll

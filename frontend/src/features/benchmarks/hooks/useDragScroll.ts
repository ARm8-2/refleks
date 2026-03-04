import { useEffect } from 'react'

type DragScrollOptions = {
  skipSelector?: string
  axis?: 'x' | 'y' | 'xy'
  threshold?: number
  enabled?: boolean
}

export function useDragScroll(ref: React.RefObject<HTMLElement>, options: DragScrollOptions = {}) {
  useEffect(() => {
    const element = ref.current
    if (!element || options.enabled === false) return

    const {
      skipSelector = 'button, a, input, textarea, select, [role="button"]',
      axis = 'x',
      threshold = 6,
    } = options

    let pointerDown = false
    let dragging = false
    let startX = 0
    let startY = 0
    let startScrollLeft = 0
    let startScrollTop = 0
    let pointerId: number | null = null

    const shouldSkip = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      try {
        if (target.closest(skipSelector)) return true
      } catch {
        return false
      }
      if (target.closest('.cursor-col-resize')) return true
      return false
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || shouldSkip(event.target)) return

      pointerDown = true
      dragging = false
      startX = event.clientX
      startY = event.clientY
      startScrollLeft = element.scrollLeft
      startScrollTop = element.scrollTop
      pointerId = event.pointerId

      try { element.setPointerCapture(pointerId) } catch { }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown || event.pointerId !== pointerId) return

      const deltaX = event.clientX - startX
      const deltaY = event.clientY - startY

      if (!dragging && Math.sqrt(deltaX * deltaX + deltaY * deltaY) < threshold) return

      dragging = true
      document.body.style.userSelect = 'none'
      element.style.cursor = 'grabbing'
      event.preventDefault()

      if (axis === 'x' || axis === 'xy') {
        element.scrollLeft = Math.max(0, startScrollLeft - deltaX)
      }
      if (axis === 'y' || axis === 'xy') {
        element.scrollTop = Math.max(0, startScrollTop - deltaY)
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown || event.pointerId !== pointerId) return

      pointerDown = false
      dragging = false
      pointerId = null
      document.body.style.userSelect = ''
      element.style.cursor = ''

      try { element.releasePointerCapture(event.pointerId) } catch { }
    }

    element.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.body.style.userSelect = ''
      try { if (pointerId != null) element.releasePointerCapture(pointerId) } catch { }
    }
  }, [ref, options.skipSelector, options.axis, options.threshold, options.enabled])
}

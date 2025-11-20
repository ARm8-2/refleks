import { useEffect } from 'react'

type HorizontalWheelOptions = {
  // Ignore wheel->horizontal mapping when cursor is left of this x offset (relative to container left)
  excludeLeftWidth?: number
}

// Maps vertical wheel movement to horizontal scrolling when content overflows.
// Optional region gating: only activate when cursor is to the right of excludeLeftWidth.
export function useHorizontalWheelScroll(ref: React.RefObject<HTMLElement>, options: HorizontalWheelOptions = {}) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (options.excludeLeftWidth != null) {
        const rect = el.getBoundingClientRect()
        const relX = e.clientX - rect.left
        if (relX < options.excludeLeftWidth) return // do not intercept
      }
      const { deltaX, deltaY } = e
      if (Math.abs(deltaY) <= Math.abs(deltaX)) return
      const atLeft = el.scrollLeft === 0
      const atRight = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth
      const goingRight = deltaY > 0
      const goingLeft = deltaY < 0
      const willScroll = (goingRight && !atRight) || (goingLeft && !atLeft)
      if (willScroll) {
        el.scrollLeft += deltaY
        e.preventDefault()
        e.stopPropagation()
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [ref, options.excludeLeftWidth])
}

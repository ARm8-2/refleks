import { useCallback, useState } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'refleks.sidebar.collapsed'

export function useSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved === 'true'
  })

  const [isHovered, setIsHovered] = useState(false)

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const collapse = useCallback(() => {
    setIsCollapsed(true)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true')
  }, [])

  const expand = useCallback(() => {
    setIsCollapsed(false)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false')
  }, [])

  // When collapsed but hovered, show expanded
  const isExpanded = !isCollapsed || isHovered

  return {
    isCollapsed,
    isHovered,
    isExpanded,
    toggle,
    collapse,
    expand,
    setIsHovered,
  }
}

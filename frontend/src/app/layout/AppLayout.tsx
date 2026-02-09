import { Outlet } from 'react-router-dom'
import { useAppInitialization, useSidebar } from '../../shared/hooks'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  useAppInitialization()

  const {
    isCollapsed,
    isExpanded,
    toggle,
    setIsHovered,
  } = useSidebar()

  return (
    <div className="flex h-screen bg-surface text-primary">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        isExpanded={isExpanded}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onToggle={toggle}
      />

      {/* Main content area */}
      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

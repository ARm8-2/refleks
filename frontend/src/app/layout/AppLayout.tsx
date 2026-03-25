import { useAppInitialization, usePersistedState } from '@/shared/hooks'
import { cn, STORAGE_KEYS } from '@/shared/lib'
import { writeLastRoute } from '@/shared/lib/navigation'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  useAppInitialization()
  const location = useLocation()

  const [desktopOpen, setDesktopOpen] = usePersistedState<boolean>(STORAGE_KEYS.sidebarOpen, true)

  useEffect(() => {
    writeLastRoute(location.pathname)
  }, [location.pathname])

  return (
    <div className="flex h-svh gap-2 bg-sidebar p-3 overflow-hidden">
      <div
        className={cn(
          'h-full shrink-0 transition-[width] duration-200 ease-out',
          desktopOpen ? 'w-60' : 'w-12',
        )}
      >
        <Sidebar open={desktopOpen} onToggle={() => setDesktopOpen(prev => !prev)} />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-canvas shadow">
        <Outlet />
      </main>
    </div>
  )
}

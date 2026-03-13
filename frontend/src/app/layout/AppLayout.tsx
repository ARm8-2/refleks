import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAppInitialization } from '../../shared/hooks'
import { cn } from '../../shared/lib'
import { Sidebar } from './Sidebar'

const SIDEBAR_OPEN_KEY = 'refleks.sidebar.open'

export function AppLayout() {
  useAppInitialization()

  const [desktopOpen, setDesktopOpenState] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_OPEN_KEY)
    return saved !== 'false' // default open
  })

  const setDesktopOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setDesktopOpenState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(next))
      return next
    })
  }, [])

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

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow">
        <Outlet />
      </main>
    </div>
  )
}

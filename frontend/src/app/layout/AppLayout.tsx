import { useCallback, useState, type CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { SidebarInset, SidebarProvider } from '../../shared/components/ui/sidebar'
import { useAppInitialization } from '../../shared/hooks'
import { Sidebar } from './Sidebar'

const SIDEBAR_OPEN_KEY = 'refleks.sidebar.open'

export function AppLayout() {
  useAppInitialization()

  const [open, setOpenState] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_OPEN_KEY)
    return saved !== 'false' // default open
  })

  const setOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setOpenState(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(next))
      return next
    })
  }, [])

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      className="h-svh overflow-hidden"
      style={{ '--sidebar-width-icon': '2.5rem' } as CSSProperties}
    >
      <Sidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

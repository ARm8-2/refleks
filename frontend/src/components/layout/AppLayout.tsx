import { Outlet } from 'react-router-dom'
import { useAppInitialization } from '../../hooks/useAppInitialization'
import { TopNav } from './TopNav'

export function AppLayout() {
  useAppInitialization()

  return (
    <div className="flex flex-col h-screen bg-surface text-primary">
      <TopNav />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}

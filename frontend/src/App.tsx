import { useEffect, useRef, useState } from 'react'
import { EventsOn } from '../wailsjs/runtime'
import { getRecentScenarios, getSettings, startWatcher } from './lib/internal'
import { applyTheme, getSavedTheme } from './lib/theme'
import { BenchmarksPage } from './pages/Benchmarks'
import { ScenariosPage } from './pages/Scenarios'
import { SessionsPage } from './pages/Sessions'
import { SettingsPage } from './pages/Settings'
import { StoreProvider, useStore } from './store/store'

function Link({ to, children }: { to: string, children: React.ReactNode }) {
  const onClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault()
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const active = window.location.pathname === to
  return (
    <a
      href={to}
      onClick={onClick}
      className={`px-3 py-1 rounded hover:bg-[var(--bg-tertiary)] ${active ? 'bg-[var(--bg-tertiary)]' : ''}`}
    >
      {children}
    </a>
  )
}

function TopNav() {
  const link = (to: string, label: string) => (
    <Link to={to}>{label}</Link>
  )
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] border-b border-[var(--border-primary)]">
      <div className="flex items-center gap-2">
        <div className="font-semibold">RefleK's</div>
        <a
          href="https://github.com/ARm8-2/refleks"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Support & Feedback
        </a>
      </div>
      <div className="flex gap-2 items-center">
        {link('/scenarios', 'Scenarios')}
        {link('/', 'Sessions')}
        {link('/benchmarks', 'Benchmarks')}
      </div>
      <div className="flex items-center gap-2">
        <a
          href="https://github.com/ARm8-2/refleks"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Help
        </a>
        {link('/settings', 'Settings')}
      </div>
    </div>
  )
}

function Shell() {
  const addScenario = useStore(s => s.addScenario)
  const updateScenario = useStore(s => s.updateScenario)
  const incNew = useStore(s => s.incNew)
  const resetNew = useStore(s => s.resetNew)
  const setScenarios = useStore(s => s.setScenarios)
  const setSessionGap = useStore(s => s.setSessionGap)
  const [path, setPath] = useState(window.location.pathname)
  const startedRef = useRef(false)

  // Startup effect: run once to start watcher and load initial data
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    startWatcher('')
      .catch((err: unknown) => console.error('StartWatcher error:', err))

    getRecentScenarios(50)
      .then((arr) => { setScenarios(arr) })
      .catch((err: unknown) => console.warn('GetRecentScenarios failed:', err))

    // Initialize session gap for session grouping
    getSettings()
      .then((s) => { if (s && typeof s.sessionGapMinutes === 'number') setSessionGap(s.sessionGapMinutes) })
      .catch(() => { })
  }, [setScenarios, setSessionGap])

  // Subscriptions effect: keep separate so it can cleanup/re-subscribe if handlers change
  useEffect(() => {
    const off = EventsOn('ScenarioAdded', (data: any) => {
      const rec = data && data.filePath && data.stats ? data : null
      if (rec) {
        addScenario(rec)
        incNew()
      }
    })

    const offUpd = EventsOn('ScenarioUpdated', (data: any) => {
      const rec = data && data.filePath && data.stats ? data : null
      if (rec) {
        updateScenario(rec)
      }
    })

    const offWatcher = EventsOn('WatcherStarted', (_data: any) => {
      // Clear current scenarios so re-parsed existing files don't duplicate entries
      setScenarios([])
      resetNew()
    })

    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)

    return () => {
      try { off() } catch (e) { /* ignore */ }
      try { offUpd() } catch (e) { /* ignore */ }
      try { offWatcher() } catch (e) { /* ignore */ }
      window.removeEventListener('popstate', onPop)
    }
  }, [addScenario, updateScenario, incNew, setScenarios, resetNew])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <TopNav />
      <div className="flex-1 min-h-0 overflow-hidden">
        {path === '/scenarios' && <ScenariosPage />}
        {path === '/' && <SessionsPage />}
        {path === '/benchmarks' && <BenchmarksPage />}
        {path === '/settings' && <SettingsPage />}
      </div>
    </div>
  )
}

export default function App() {
  // Simple theme bootstrap: read localStorage and set class on <html>.
  useEffect(() => {
    applyTheme(getSavedTheme())
  }, [])
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

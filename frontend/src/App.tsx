import { HelpCircle, Settings as SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { BrowserOpenURL, EventsOn } from '../wailsjs/runtime'
import { KO_FI_SYMBOL } from './assets'
import { StoreProvider, useStore } from './hooks/useStore'
import { checkForUpdates, downloadAndInstallUpdate, getRecentScenarios, getSettings, getVersion, startWatcher } from './lib/internal'
import { applyTheme, getSavedTheme } from './lib/theme'
import { BenchmarksPage } from './pages/Benchmarks'
import { ScenariosPage } from './pages/Scenarios'
import { SessionsPage } from './pages/Sessions'
import { SettingsPage } from './pages/Settings'
import type { UpdateInfo } from './types/ipc'

function Link({ to, children, end = false }: { to: string, children: ReactNode, end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `px-3 py-1 rounded hover:bg-[var(--bg-tertiary)] ${isActive ? 'bg-[var(--bg-tertiary)]' : ''}`}
    >
      {children}
    </NavLink>
  )
}

function TopNav() {
  const [version, setVersion] = useState<string>('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    getVersion().then(v => setVersion(v)).catch(() => setVersion(''))
    // Proactive check (also handled by backend event)
    checkForUpdates().then((info) => { if (info?.hasUpdate) setUpdate(info) }).catch(() => { })
    // Listen for backend event
    const off = EventsOn('UpdateAvailable', (data: any) => {
      if (data && typeof data === 'object' && data.latestVersion) setUpdate(data as UpdateInfo)
    })
    return () => { try { off() } catch { /* noop */ } }
  }, [])
  const link = (to: string, label: ReactNode, end = false) => (
    <Link to={to} end={end}>{label}</Link>
  )
  return (
    <div className="relative flex items-center px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] border-b border-[var(--border-primary)]">
      <div className="flex items-center gap-2">
        <div className="font-semibold">RefleK's</div>
        {version && <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border-primary)] text-[var(--text-secondary)]">v{version}</span>}
        {update?.hasUpdate && (
          <div className="flex items-center gap-2">
            <button
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)] text-black hover:opacity-90"
              title="Click to update"
              onClick={async () => {
                if (!update?.latestVersion) return
                const ok = window.confirm(`Download and install v${update.latestVersion} now? The app will close.`)
                if (!ok) return
                try {
                  await downloadAndInstallUpdate(update.latestVersion)
                } catch (e) {
                  console.error('Update failed', e)
                  alert('Update failed: ' + (e as Error)?.message)
                }
              }}
            >
              Update to v{update.latestVersion}
            </button>
            <a
              href="https://refleks-app.com/updates/"
              onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/updates/') }}
              className="text-[10px] underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              What's new
            </a>
          </div>
        )}
      </div>

      {/* Centered tabs - absolutely centered so side content doesn't affect position */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2 items-center">
        {link('/scenarios', 'Scenarios')}
        {link('/', 'Sessions', true)}
        {link('/benchmarks', 'Benchmarks')}
      </div>

      {/* Right-side actions - pushed to the end with ml-auto */}
      <div className="flex items-center gap-2 ml-auto">
        <a
          href="https://refleks-app.com/home/#support"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/home/#support') }}
          title="Help"
          aria-label="Open help (docs)"
          className="px-3 py-1 rounded hover:bg-[var(--bg-tertiary)] flex items-center"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Help</span>
        </a>

        <a
          href="https://ko-fi.com/arm8_"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://ko-fi.com/arm8_') }}
          title="Support on Ko-fi"
          className="px-3 py-1 rounded hover:bg-[var(--bg-tertiary)] flex items-center"
        >
          <img src={KO_FI_SYMBOL} alt="Ko-fi" className="h-5 w-5" />
        </a>

        {link('/settings', (
          <>
            <SettingsIcon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Settings</span>
          </>
        ))}
      </div>
    </div>
  )
}

function AppLayout() {
  const addScenario = useStore(s => s.addScenario)
  const updateScenario = useStore(s => s.updateScenario)
  const incNew = useStore(s => s.incNew)
  const resetNew = useStore(s => s.resetNew)
  const setScenarios = useStore(s => s.setScenarios)
  const setSessionGap = useStore(s => s.setSessionGap)
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

    return () => {
      try { off() } catch (e) { /* ignore */ }
      try { offUpd() } catch (e) { /* ignore */ }
      try { offWatcher() } catch (e) { /* ignore */ }
    }
  }, [addScenario, updateScenario, incNew, setScenarios, resetNew])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <TopNav />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
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
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<SessionsPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="benchmarks" element={<BenchmarksPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </StoreProvider>
  )
}

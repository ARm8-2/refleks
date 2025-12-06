import { HelpCircle, Settings as SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Component, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { BrowserOpenURL, EventsOn } from '../wailsjs/runtime'
import { DISCORD_SYMBOL, KO_FI_SYMBOL } from './assets'
import { StoreProvider, useStore } from './hooks/useStore'
import { checkForUpdates, downloadAndInstallUpdate, getRecentScenarios, getSettings, getVersion, startWatcher } from './lib/internal'
import { applyFont, applyTheme, getSavedFont, getSavedTheme } from './lib/theme'
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
      className={({ isActive }) => `px-3 py-1 rounded hover:bg-surface-3 ${isActive ? 'bg-surface-3' : ''}`}
    >
      {children}
    </NavLink>
  )
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; stack?: string }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    console.error('Unhandled error in UI', error, info)
    this.setState({ stack: info?.componentStack })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface text-primary flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded border border-primary bg-surface-2 p-4 space-y-3 shadow-md">
            <div className="text-lg font-semibold">Something went wrong.</div>
            <div className="text-secondary text-sm break-words whitespace-pre-wrap">{this.state.error.message}</div>
            {this.state.error?.stack && (
              <div className="text-[11px] text-muted whitespace-pre-wrap bg-surface-3 border border-primary rounded p-2 overflow-auto max-h-48">
                {this.state.error.stack}
              </div>
            )}
            {this.state.stack && (
              <div className="text-[11px] text-muted whitespace-pre-wrap bg-surface-3 border border-primary rounded p-2 overflow-auto max-h-48">
                {this.state.stack}
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded bg-accent text-on-accent text-sm"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                className="px-3 py-1.5 rounded border border-primary text-sm hover:bg-surface-3"
                onClick={() => this.setState({ error: null })}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
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
    <div className="relative flex items-center px-4 py-2 bg-surface-2 text-primary border-b border-primary">
      <div className="flex items-center gap-2">
        <div className="font-semibold">RefleK's</div>
        {version && <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary text-secondary">v{version}</span>}
        {update?.hasUpdate && (
          <div className="flex items-center gap-2">
            <button
              className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-on-accent hover:opacity-90"
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
              className="text-[10px] underline underline-offset-2 text-secondary hover:text-primary"
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
          href="https://discord.gg/SFsf4GQhJU"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://discord.gg/SFsf4GQhJU') }}
          title="Join our Discord"
          className="px-3 py-1 rounded hover:bg-surface-3 flex items-center"
        >
          <img src={DISCORD_SYMBOL} alt="Discord" className="h-5 w-auto" />
        </a>

        <a
          href="https://refleks-app.com/home/#support"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/home/#support') }}
          title="Help"
          className="px-3 py-1 rounded hover:bg-surface-3 flex items-center"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Help</span>
        </a>

        <a
          href="https://ko-fi.com/arm8_"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://ko-fi.com/arm8_') }}
          title="Support on Ko-fi"
          className="px-3 py-1 rounded hover:bg-surface-3 flex items-center"
        >
          <img src={KO_FI_SYMBOL} alt="Ko-fi" className="h-5 w-auto" />
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
    <div className="flex flex-col h-screen bg-surface text-primary">
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
    applyFont(getSavedFont())
  }, [])
  return (
    <StoreProvider>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<SessionsPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="benchmarks" element={<BenchmarksPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AppErrorBoundary>
    </StoreProvider>
  )
}

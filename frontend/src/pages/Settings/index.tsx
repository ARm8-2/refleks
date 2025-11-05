import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { BrowserOpenURL } from '../../../wailsjs/runtime'
import { Button, Dropdown } from '../../components'
import { useStore } from '../../hooks/useStore'
import { checkForUpdates, downloadAndInstallUpdate, getSettings, getVersion, resetSettings, updateSettings } from '../../lib/internal'
import { applyTheme, getSavedTheme, setTheme, THEMES, type Theme } from '../../lib/theme'
import type { Settings, UpdateInfo } from '../../types/ipc'

export function SettingsPage() {
  const setSessionGap = useStore(s => s.setSessionGap)
  const [steamDir, setSteamDir] = useState('')
  const [steamIdOverride, setSteamIdOverride] = useState('')
  const [statsPath, setStatsPath] = useState('')
  const [tracesPath, setTracesPath] = useState('')
  const [gap, setGap] = useState(15)
  const [theme, setThemeState] = useState<Theme>(getSavedTheme())
  const [mouseEnabled, setMouseEnabled] = useState(false)
  const [mouseBuffer, setMouseBuffer] = useState(10)
  const [maxExisting, setMaxExisting] = useState(500)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // Updates state
  const [currentVersion, setCurrentVersion] = useState<string>("")
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState<boolean>(false)
  const [checkError, setCheckError] = useState<string>("")

  useEffect(() => {
    // Load settings from backend and trust backend-sanitized values.
    getSettings()
      .then((s: Settings) => {
        if (!s) return
        setSteamDir((s as any).steamInstallDir || '')
        setSteamIdOverride((s as any).steamIdOverride || '')
        setStatsPath(s.statsDir || '')
        setTracesPath((s as any).tracesDir || '')
        setGap(s.sessionGapMinutes)
        setThemeState(s.theme)
        applyTheme(s.theme)
        setMouseEnabled(Boolean(s.mouseTrackingEnabled))
        setMouseBuffer(Number(s.mouseBufferMinutes))
        setMaxExisting(Number((s as any).maxExistingOnStart))
      })
      .catch(() => { })
    // Load current version for display
    getVersion().then(v => setCurrentVersion(String(v || ''))).catch(() => setCurrentVersion(''))
  }, [])

  const save = async () => {
    const payload: Settings = { steamInstallDir: steamDir, steamIdOverride, statsDir: statsPath, tracesDir: tracesPath, sessionGapMinutes: gap, theme, mouseTrackingEnabled: mouseEnabled, mouseBufferMinutes: mouseBuffer, maxExistingOnStart: maxExisting }
    try {
      await updateSettings(payload)
      setTheme(theme)
      setSessionGap(gap)
    } catch (e) {
      console.error('UpdateSettings error:', e)
    }
  }
  const onReset = async () => {
    try {
      await resetSettings()
      const s = await getSettings()
      setSteamDir((s as any).steamInstallDir || '')
      setSteamIdOverride((s as any).steamIdOverride || '')
      setStatsPath(s.statsDir || '')
      setTracesPath((s as any).tracesDir || '')
      setGap(s.sessionGapMinutes)
      setThemeState(s.theme)
      setTheme(s.theme)
      setMouseEnabled(Boolean(s.mouseTrackingEnabled))
      setMouseBuffer(Number(s.mouseBufferMinutes))
      setMaxExisting(Number((s as any).maxExistingOnStart))
    } catch (e) {
      console.error('ResetSettings error:', e)
    }
  }
  return (
    <div className="space-y-4 h-full overflow-auto p-4">
      <div className="text-lg font-medium">Settings</div>
      <div className="space-y-6 max-w-5xl">
        {/* Updates */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Updates</h3>
          <div className="space-y-3 p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <div className="text-sm text-[var(--text-secondary)]">
              Current version: <span className="text-[var(--text-primary)]">v{currentVersion || '—'}</span>
            </div>
            {update?.hasUpdate ? (
              <div className="flex items-center gap-2">
                <div className="text-sm">Update available: v{update.latestVersion}</div>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={async () => {
                    if (!update?.latestVersion) return
                    const ok = window.confirm(`Download and install v${update.latestVersion} now? The app will close.`)
                    if (!ok) return
                    try {
                      await downloadAndInstallUpdate(update.latestVersion)
                    } catch (e) {
                      console.error('Update install failed', e)
                      alert('Update failed: ' + (e as Error)?.message)
                    }
                  }}
                >
                  Install update
                </Button>
                <a
                  className="text-xs underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  href="https://refleks-app.com/updates/"
                  onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/updates/') }}
                >
                  What’s new
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={checking}
                  onClick={async () => {
                    setChecking(true)
                    setCheckError('')
                    try {
                      const info = await checkForUpdates()
                      setUpdate(info)
                    } catch (e) {
                      const msg = (e as Error)?.message || 'Update check failed'
                      setCheckError(msg)
                    } finally {
                      setChecking(false)
                    }
                  }}
                >
                  {checking ? 'Checking…' : 'Check for updates'}
                </Button>
                {checkError && <span className="text-xs text-red-400">{checkError}</span>}
                {update && !update.hasUpdate && !checking && (
                  <span className="text-xs text-[var(--text-secondary)]">You’re up to date.</span>
                )}
                <a
                  className="text-xs underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  href="https://refleks-app.com/updates/"
                  onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/updates/') }}
                >
                  View updates page
                </a>
              </div>
            )}
          </div>
        </section>

        {/* General (primary settings) */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">General</h3>
          <div className="space-y-3 p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <Field label="Stats directory">
              <input
                value={statsPath}
                onChange={e => setStatsPath(e.target.value)}
                className="w-full px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
              />
            </Field>
            <Field label="Enable mouse tracking (Windows)">
              <Dropdown
                value={mouseEnabled ? 'on' : 'off'}
                onChange={(v: string) => setMouseEnabled(v === 'on')}
                options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
                size="md"
              />
            </Field>
            <Field label="Session gap (minutes)">
              <input
                type="number"
                value={gap}
                onChange={e => setGap(Number(e.target.value))}
                className="w-24 px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
              />
            </Field>
            <Field label="Theme">
              <Dropdown
                value={theme}
                onChange={(v: string) => setThemeState(v as Theme)}
                options={THEMES.map(t => ({
                  label: t.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                  value: t,
                }))}
                size="md"
              />
            </Field>
          </div>
        </section>

        {/* Advanced - nested under General as a collapsible block */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Advanced</h3>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            >
              {showAdvanced ? 'Hide' : 'Show'} advanced
            </button>
          </div>
          {showAdvanced && (
            <div className="space-y-3 p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <Field label="Steam install directory">
                <input
                  value={steamDir}
                  onChange={e => setSteamDir(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                />
              </Field>
              <Field label="SteamID override (optional)">
                <input
                  value={steamIdOverride}
                  onChange={e => setSteamIdOverride(e.target.value)}
                  placeholder="7656119..."
                  className="w-full px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                />
              </Field>
              <Field label="Traces directory">
                <input
                  value={tracesPath}
                  onChange={e => setTracesPath(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                />
              </Field>
              <Field label="Mouse buffer (minutes)">
                <input
                  type="number"
                  value={mouseBuffer}
                  onChange={e => setMouseBuffer(Math.max(1, Number(e.target.value)))}
                  className="w-24 px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                />
              </Field>
              <Field label="Parse existing on start (max)">
                <input
                  type="number"
                  value={maxExisting}
                  onChange={e => setMaxExisting(Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                />
              </Field>
            </div>
          )}
        </section>

        {/* Actions & Help */}
        <section>
          <div className="flex items-center gap-2">
            <Button variant="accent" size="md" onClick={save}>Save</Button>
            <Button variant="secondary" size="md" onClick={onReset}>Reset to defaults</Button>
          </div>
        </section>
      </div>
    </div>
  )
}

type FieldProps = { label: string; children: ReactNode }

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex items-center gap-3">
      <div className="w-48 text-sm text-[var(--text-primary)]">{label}</div>
      <div className="flex-1">{children}</div>
    </label>
  )
}

export default SettingsPage

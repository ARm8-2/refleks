import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { BrowserOpenURL } from '../../../wailsjs/runtime';
import { ClearCacheModal } from '../../components/settings/ClearCacheModal';
import { ResetSettingsModal } from '../../components/settings/ResetSettingsModal';
import { Button } from '../../components/shared/Button';
import { Dropdown } from '../../components/shared/Dropdown';
import { Loading } from '../../components/shared/Loading';
import { useStore } from '../../hooks/useStore';
import { MISSING_STR } from '../../lib/constants';
import { checkForUpdates, clearCache, downloadAndInstallUpdate, getSettings, getVersion, quitApp, resetSettings, setAutostart, updateSettings } from '../../lib/internal';
import { FONTS, setFont, setTheme, THEMES, type Font, type Theme } from '../../lib/theme';
import type { Settings, UpdateInfo } from '../../types/ipc';

export function SettingsPage() {
  const setSessionGap = useStore(s => s.setSessionGap)
  const setSessionNotes = useStore(s => s.setSessionNotes)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Updates state
  const [currentVersion, setCurrentVersion] = useState<string>("")
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState<boolean>(false)
  const [checkError, setCheckError] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => { })
    getVersion().then(v => setCurrentVersion(String(v || ''))).catch(() => setCurrentVersion(''))
  }, [])

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      if (!prev) return null
      const next = { ...prev, [key]: value }
      return next
    })
  }

  const handleAutostartChange = async (enabled: boolean) => {
    try {
      await setAutostart(enabled)
      updateField('autostartEnabled', enabled)
    } catch (e) {
      console.error('SetAutostart error:', e)
      alert('Failed to update autostart: ' + (e as Error)?.message)
    }
  }

  const save = async () => {
    if (!settings || saving) return
    setSaving(true)
    try {
      await updateSettings(settings)
      setTheme(settings.theme)
      setFont(settings.font)
      setSessionGap(settings.sessionGapMinutes)
    } catch (e) {
      console.error('UpdateSettings error:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (config: boolean, favorites: boolean, scenarioNotes: boolean, sessionNotes: boolean) => {
    try {
      await resetSettings(config, favorites, scenarioNotes, sessionNotes)
      const s = await getSettings()
      setSettings(s)

      setTheme(s.theme)
      setFont(s.font)
      setSessionGap(s.sessionGapMinutes)

      if (sessionNotes) {
        setSessionNotes(s.sessionNotes || {})
      }
    } catch (e) {
      console.error('ResetSettings error:', e)
    }
  }

  const handleClearCache = async () => {
    try {
      await clearCache()
    } catch (e) {
      console.error('ClearCache error:', e)
      alert('Failed to clear cache: ' + (e as Error)?.message)
    }
  }

  if (!settings) return <Loading />

  return (
    <div className="space-y-4 h-full overflow-auto p-4">
      <div className="text-lg font-medium">Settings</div>
      <div className="space-y-6 max-w-5xl">
        {/* Updates */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">Updates</h3>
          <div className="space-y-3 p-3 rounded border border-primary bg-surface-2">
            <div className="text-sm text-secondary">
              Current version: <span className="text-primary">v{currentVersion || MISSING_STR}</span>
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
                  className="text-xs underline underline-offset-2 text-secondary hover:text-primary"
                  href="https://refleks-app.com/changelog/"
                  onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/changelog/') }}
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
                  <span className="text-xs text-secondary">You’re up to date.</span>
                )}
                <a
                  className="text-xs underline underline-offset-2 text-secondary hover:text-primary"
                  href="https://refleks-app.com/changelog/"
                  onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/changelog/') }}
                >
                  View changelog
                </a>
              </div>
            )}
          </div>
        </section>

        {/* General (primary settings) */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">General</h3>
          <div className="space-y-3 p-3 rounded border border-primary bg-surface-2">
            <Field label="Stats directory">
              <input
                value={settings.statsDir}
                onChange={e => updateField('statsDir', e.target.value)}
                className="w-full px-2 py-1 rounded bg-surface-3 border border-primary"
              />
            </Field>
            <Field label="Autostart with Kovaak's">
              <div className="flex flex-col gap-1">
                <Dropdown
                  value={settings.autostartEnabled ? 'on' : 'off'}
                  onChange={(v: string) => handleAutostartChange(v === 'on')}
                  options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
                  size="md"
                />
                {/* <span className="text-xs text-secondary">
                  When enabled, RefleK's will start hidden with Windows and open automatically when Kovaak's launches.
                  Closing the window will keep it in memory.
                </span> */}
              </div>
            </Field>
            <Field label="Enable mouse tracking (Windows)">
              <Dropdown
                value={settings.mouseTrackingEnabled ? 'on' : 'off'}
                onChange={(v: string) => updateField('mouseTrackingEnabled', v === 'on')}
                options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
                size="md"
              />
            </Field>
            <Field label="Session gap (minutes)">
              <input
                type="number"
                value={settings.sessionGapMinutes}
                onChange={e => updateField('sessionGapMinutes', Number(e.target.value))}
                className="w-24 px-2 py-1 rounded bg-surface-3 border border-primary"
              />
            </Field>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">Appearance</h3>
          <div className="space-y-3 p-3 rounded border border-primary bg-surface-2">
            <Field label="Theme">
              <Dropdown
                value={settings.theme}
                onChange={(v: string) => updateField('theme', v as Theme)}
                options={THEMES.map(t => ({
                  label: t.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                  value: t,
                }))}
                size="md"
              />
            </Field>
            <Field label="Font">
              <Dropdown
                value={settings.font}
                onChange={(v: string) => updateField('font', v as Font)}
                options={FONTS.map(f => ({ label: f.label, value: f.id }))}
                size="md"
              />
            </Field>
          </div>
        </section>

        {/* Advanced - nested under General as a collapsible block */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">Advanced</h3>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs px-2 py-1 rounded bg-surface-2 border border-primary text-secondary hover:bg-surface-3"
            >
              {showAdvanced ? 'Hide' : 'Show'} advanced
            </button>
          </div>
          {showAdvanced && (
            <div className="space-y-3 p-3 rounded border border-primary bg-surface-2">
              <Field label="Steam install directory">
                <input
                  value={settings.steamInstallDir || ''}
                  onChange={e => updateField('steamInstallDir', e.target.value)}
                  className="w-full px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              <Field label="SteamID override (optional)">
                <input
                  value={settings.steamIdOverride || ''}
                  onChange={e => updateField('steamIdOverride', e.target.value)}
                  placeholder="7656119..."
                  className="w-full px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              <Field label="Persona Name override (optional)">
                <input
                  value={settings.personaNameOverride || ''}
                  onChange={e => updateField('personaNameOverride', e.target.value)}
                  placeholder="Steam Persona Name"
                  className="w-full px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              <Field label="Traces directory">
                <input
                  value={settings.tracesDir}
                  onChange={e => updateField('tracesDir', e.target.value)}
                  className="w-full px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              <Field label="Mouse buffer (minutes)">
                <input
                  type="number"
                  value={settings.mouseBufferMinutes}
                  onChange={e => updateField('mouseBufferMinutes', Math.max(1, Number(e.target.value)))}
                  className="w-24 px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              <Field label="Parse existing on start (max)">
                <input
                  type="number"
                  value={settings.maxExistingOnStart}
                  onChange={e => updateField('maxExistingOnStart', Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              {/* <Field label="Gemini API key">
                <input
                  value={settings.geminiApiKey || ''}
                  onChange={e => updateField('geminiApiKey', e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-2 py-1 rounded bg-surface-3 border border-primary"
                />
              </Field>
              <div className="text-xs text-secondary">
                You can also set the environment variable <code className="px-1 py-0.5 rounded bg-surface-3 border border-primary">REFLEKS_GEMINI_API_KEY</code> to override this value at runtime.
              </div> */}
            </div>
          )}
        </section>

        {/* Actions & Help */}
        <section>
          <div className="flex items-center gap-2">
            <Button variant="accent" size="md" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant="secondary" size="md" onClick={() => setIsResetOpen(true)} disabled={saving}>Reset to defaults</Button>
            <Button variant="secondary" size="md" onClick={() => setIsClearCacheOpen(true)} disabled={saving}>Clear Cache</Button>
            {settings.autostartEnabled && (
              <Button variant="danger" size="md" onClick={() => quitApp()}>Quit App</Button>
            )}
          </div>
        </section>
      </div>
      <ResetSettingsModal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} onConfirm={handleReset} />
      <ClearCacheModal isOpen={isClearCacheOpen} onClose={() => setIsClearCacheOpen(false)} onConfirm={handleClearCache} />
    </div>
  )
}

type FieldProps = { label: string; children: ReactNode }

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex items-center gap-3">
      <div className="w-48 text-sm text-primary">{label}</div>
      <div className="flex-1">{children}</div>
    </label>
  )
}

export default SettingsPage

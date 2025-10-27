import { useEffect, useState } from 'react'
import { Button, Dropdown } from '../../components'
import { useStore } from '../../hooks/useStore'
import { getSettings, resetSettings, updateSettings } from '../../lib/internal'
import { applyTheme, getSavedTheme, setTheme, THEMES, type Theme } from '../../lib/theme'
import type { Settings } from '../../types/ipc'

export function SettingsPage() {
  const setSessionGap = useStore(s => s.setSessionGap)
  const [steamDir, setSteamDir] = useState('')
  const [statsPath, setStatsPath] = useState('')
  const [tracesPath, setTracesPath] = useState('')
  const [gap, setGap] = useState(30)
  const [theme, setThemeState] = useState<Theme>(getSavedTheme())
  const [mouseEnabled, setMouseEnabled] = useState(false)
  const [mouseBuffer, setMouseBuffer] = useState(10)
  const [maxExisting, setMaxExisting] = useState(500)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    // Load settings from backend and trust backend-sanitized values.
    getSettings()
      .then((s: Settings) => {
        if (!s) return
        setSteamDir((s as any).steamInstallDir || '')
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
  }, [])

  const save = async () => {
    const payload: Settings = { steamInstallDir: steamDir, statsDir: statsPath, tracesDir: tracesPath, sessionGapMinutes: gap, theme, mouseTrackingEnabled: mouseEnabled, mouseBufferMinutes: mouseBuffer, maxExistingOnStart: maxExisting }
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
    <div className="space-y-4 h-full flex flex-col p-4">
      <div className="text-lg font-medium">Settings</div>
      <div className="space-y-6 max-w-5xl">
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
                options={THEMES.map(t => ({ label: t[0].toUpperCase() + t.slice(1), value: t }))}
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
              <Field label="Traces directory">
                <input
                  value={tracesPath}
                  onChange={e => setTracesPath(e.target.value)}
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
            <div className="text-xs text-[var(--text-secondary)] ml-2">Settings persist to your OS config folder. Theme applies immediately.</div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3">
      <div className="w-48 text-sm text-[var(--text-primary)]">{label}</div>
      <div className="flex-1">{children}</div>
    </label>
  )
}

export default SettingsPage

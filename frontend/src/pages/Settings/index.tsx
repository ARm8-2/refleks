import { useEffect, useState } from 'react'
import { getSettings, resetSettings, updateSettings } from '../../lib/internal'
import { applyTheme, getSavedTheme, setTheme, THEMES, type Theme } from '../../lib/theme'
import { useStore } from '../../store/store'
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

  useEffect(() => {
    getSettings()
      .then((s: Settings) => {
        if (s) {
          setSteamDir((s as any).steamInstallDir || 'C:/Program Files (x86)/Steam')
          setStatsPath(s.statsDir || '')
          setTracesPath((s as any).tracesDir || '{defaultconfigpath}/traces')
          setGap(Number(s.sessionGapMinutes) || 30)
          const isTheme = (val: string): val is Theme => (THEMES as readonly string[]).includes(val)
          const safe: Theme = (typeof s.theme === 'string' && isTheme(s.theme)) ? s.theme : 'dark'
          setThemeState(safe)
          applyTheme(safe)
          setMouseEnabled(Boolean(s.mouseTrackingEnabled))
          setMouseBuffer(Number(s.mouseBufferMinutes) > 0 ? Number(s.mouseBufferMinutes) : 10)
          setMaxExisting(Number((s as any).maxExistingOnStart) > 0 ? Number((s as any).maxExistingOnStart) : 500)
        }
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
      setSteamDir((s as any).steamInstallDir || 'C:/Program Files (x86)/Steam')
      setStatsPath(s.statsDir || '')
      setTracesPath((s as any).tracesDir || '{defaultconfigpath}/traces')
      setGap(Number(s.sessionGapMinutes) || 30)
      const isTheme = (val: string): val is Theme => (THEMES as readonly string[]).includes(val)
      const safe: Theme = (typeof s.theme === 'string' && isTheme(s.theme)) ? s.theme : 'dark'
      setThemeState(safe)
      setTheme(safe)
      setMouseEnabled(Boolean(s.mouseTrackingEnabled))
      setMouseBuffer(Number(s.mouseBufferMinutes) > 0 ? Number(s.mouseBufferMinutes) : 10)
      setMaxExisting(Number((s as any).maxExistingOnStart) > 0 ? Number((s as any).maxExistingOnStart) : 500)
    } catch (e) {
      console.error('ResetSettings error:', e)
    }
  }
  return (
    <div className="space-y-4 h-full flex flex-col p-4">
      <div className="text-lg font-medium">Settings</div>
      <div className="space-y-3 max-w-xl">
        <Field label="Steam install directory">
          <input value={steamDir} onChange={e => setSteamDir(e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]" />
        </Field>
        <Field label="Stats directory">
          <input value={statsPath} onChange={e => setStatsPath(e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]" />
        </Field>
        <Field label="Traces directory">
          <input value={tracesPath} onChange={e => setTracesPath(e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]" />
        </Field>
        <Field label="Session gap (minutes)">
          <input type="number" value={gap} onChange={e => setGap(Number(e.target.value))} className="w-24 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]" />
        </Field>
        <Field label="Enable mouse tracking (Windows)">
          <input type="checkbox" checked={mouseEnabled} onChange={e => setMouseEnabled(e.target.checked)} />
        </Field>
        <Field label="Mouse buffer (minutes)">
          <input type="number" value={mouseBuffer} onChange={e => setMouseBuffer(Math.max(1, Number(e.target.value)))} className="w-24 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]" />
        </Field>
        <Field label="Parse existing on start (max)">
          <input type="number" value={maxExisting} onChange={e => setMaxExisting(Math.max(0, Number(e.target.value)))} className="w-24 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]" />
        </Field>
        <Field label="Theme">
          <select value={theme} onChange={e => setThemeState(e.target.value as Theme)} className="px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            {THEMES.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </select>
        </Field>
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <button onClick={save} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm">Save</button>
            <button onClick={onReset} className="px-3 py-1 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm">Reset to defaults</button>
          </div>
        </div>
        <div className="text-xs text-[var(--text-secondary)]">Settings persist to your OS config folder. Theme applies immediately.</div>
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

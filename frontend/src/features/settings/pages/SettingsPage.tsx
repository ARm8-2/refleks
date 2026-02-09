import { ChevronDown, ChevronUp, Download, ExternalLink, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  CheckForUpdates,
  GetDefaultSettings,
  GetSettings,
  GetVersion,
  QuitApp,
  SetAutostart,
  UpdateSettings,
} from '../../../../wailsjs/go/main/App'
import { models } from '../../../../wailsjs/go/models'
import { BrowserOpenURL } from '../../../../wailsjs/runtime'
import { Button } from '../../../shared/components/Button'
import { Dropdown, type DropdownOption } from '../../../shared/components/Dropdown'
import { useStore } from '../../../shared/hooks/useStore'
import { FONTS, THEMES, setFont, setTheme, type Font, type Theme } from '../../../shared/lib/theme'
import { ClearCacheModal } from '../components/ClearCacheModal'
import { ResetSettingsModal } from '../components/ResetSettingsModal'
import { SettingsField } from '../components/SettingsField'
import { SettingsSection } from '../components/SettingsSection'

type Settings = models.Settings
type UpdateInfo = models.UpdateInfo

const MISSING_STR = 'N/A'

const themeOptions: DropdownOption[] = THEMES.map(t => ({ label: t, value: t }))
const fontOptions: DropdownOption[] = FONTS.map(f => ({ label: f.label, value: f.id }))
const sessionGapOptions: DropdownOption[] = [5, 10, 15, 20, 30, 45, 60, 90, 120].map(m => ({
  label: `${m} minutes`,
  value: String(m),
}))

export function SettingsPage() {
  const setSessionGap = useStore(s => s.setSessionGap)
  const setSessionNotes = useStore(s => s.setSessionNotes)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Updates state
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState<boolean>(false)
  const [checkError, setCheckError] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    GetSettings().then(setSettings).catch(() => { })
    GetVersion()
      .then(v => setCurrentVersion(String(v || '')))
      .catch(() => setCurrentVersion(''))
  }, [])

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      if (!prev) return null
      return models.Settings.createFrom({ ...prev, [key]: value })
    })
  }

  const handleAutostartChange = async (enabled: boolean) => {
    try {
      await SetAutostart(enabled)
      updateField('autostartEnabled', enabled)
    } catch (e) {
      console.error('SetAutostart error:', e)
      alert('Failed to update autostart: ' + (e as Error)?.message)
    }
  }

  const handleThemeChange = (value: string) => {
    const theme = value as Theme
    setTheme(theme)
    updateField('theme', theme)
  }

  const handleFontChange = (value: string) => {
    const font = value as Font
    setFont(font)
    updateField('font', font)
  }

  const handleCheckUpdate = async () => {
    setChecking(true)
    setCheckError('')
    try {
      const info = await CheckForUpdates()
      setUpdate(info)
    } catch (e) {
      setCheckError((e as Error)?.message || 'Failed to check for updates')
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await UpdateSettings(settings)
      setSessionGap(settings.sessionGapMinutes)
      if (settings.sessionNotes) {
        const notes: Record<string, { name: string; notes: string }> = {}
        for (const [key, val] of Object.entries(settings.sessionNotes)) {
          notes[key] = { name: val.name, notes: val.notes }
        }
        setSessionNotes(notes)
      }
    } catch (e) {
      console.error('Save error:', e)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      const defaults = await GetDefaultSettings()
      setSettings(defaults)
      setTheme(defaults.theme as Theme)
      if (defaults.font) setFont(defaults.font as Font)
    } catch (e) {
      console.error('Reset error:', e)
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-secondary">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-primary px-6 py-4">
        <h1 className="text-xl font-semibold text-primary">Settings</h1>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Updates */}
        <SettingsSection title="Updates">
          <div className="flex items-center gap-4">
            <span className="text-secondary text-sm">Current version: <span className="text-primary font-mono">{currentVersion || MISSING_STR}</span></span>
            <Button onClick={handleCheckUpdate} disabled={checking} variant="secondary" size="sm">
              {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check for Updates'}
            </Button>
            {checkError && <span className="text-danger text-sm">{checkError}</span>}
            {update && !update.hasUpdate && (
              <span className="text-secondary text-sm">You're on the latest version!</span>
            )}
          </div>
          {update?.hasUpdate && (
            <div className="bg-surface-2 rounded-lg p-4 border border-accent/30 space-y-3 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-primary text-sm font-medium">Version {update.latestVersion} available</span>
              </div>
              {update.releaseNotes && (
                <p className="text-secondary text-xs whitespace-pre-wrap max-h-24 overflow-auto">
                  {update.releaseNotes}
                </p>
              )}
              <Button onClick={() => update.downloadUrl && BrowserOpenURL(update.downloadUrl)} variant="accent" size="sm">
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </Button>
            </div>
          )}
        </SettingsSection>

        {/* General */}
        <SettingsSection title="General">
          <SettingsField label="Stats Directory" description="Path to KovaaK's stats folder">
            <input
              type="text"
              value={settings.statsDir}
              onChange={e => updateField('statsDir', e.target.value)}
              className="w-full max-w-xl px-3 py-1.5 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </SettingsField>

          <SettingsField label="Start with Windows" description="Launch RefleK's when you log in" inline>
            <button
              onClick={() => handleAutostartChange(!settings.autostartEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.autostartEnabled ? 'bg-accent' : 'bg-surface-3 border border-primary'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${settings.autostartEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
          </SettingsField>

          <SettingsField label="Mouse Tracking" description="Record mouse movement during scenarios" inline>
            <button
              onClick={() => updateField('mouseTrackingEnabled', !settings.mouseTrackingEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.mouseTrackingEnabled ? 'bg-accent' : 'bg-surface-3 border border-primary'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${settings.mouseTrackingEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
          </SettingsField>

          <SettingsField label="Session Gap" description="Minutes of inactivity before starting a new session" inline>
            <Dropdown
              value={String(settings.sessionGapMinutes)}
              onChange={v => updateField('sessionGapMinutes', parseInt(v, 10))}
              options={sessionGapOptions}
              size="md"
            />
          </SettingsField>
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingsField label="Theme" description="Color theme for the application" inline>
            <Dropdown
              value={settings.theme}
              onChange={handleThemeChange}
              options={themeOptions}
              size="md"
            />
          </SettingsField>

          <SettingsField label="Font" description="Font family for the interface" inline>
            <Dropdown
              value={settings.font || FONTS[0].id}
              onChange={handleFontChange}
              options={fontOptions}
              size="md"
            />
          </SettingsField>
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection title="Advanced">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-secondary hover:text-primary transition-colors text-sm -mt-1"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-6">
              <SettingsSection title="Steam">
                <SettingsField label="Steam Install Directory">
                  <input
                    type="text"
                    value={settings.steamInstallDir}
                    onChange={e => updateField('steamInstallDir', e.target.value)}
                    className="w-full max-w-xl px-3 py-1.5 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </SettingsField>

                <SettingsField label="Steam ID Override" description="Leave empty to auto-detect">
                  <input
                    type="text"
                    value={settings.steamIdOverride || ''}
                    onChange={e => updateField('steamIdOverride', e.target.value || undefined)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
                    placeholder="76561198000000000"
                  />
                </SettingsField>

                <SettingsField label="Persona Name Override" description="Leave empty to auto-detect">
                  <input
                    type="text"
                    value={settings.personaNameOverride || ''}
                    onChange={e => updateField('personaNameOverride', e.target.value || undefined)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Display name"
                  />
                </SettingsField>
              </SettingsSection>

              <SettingsSection title="Mouse Traces">
                <SettingsField label="Traces Directory">
                  <input
                    type="text"
                    value={settings.tracesDir}
                    onChange={e => updateField('tracesDir', e.target.value)}
                    className="w-full max-w-xl px-3 py-1.5 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </SettingsField>

                <SettingsField label="Buffer Duration" description="Minutes of mouse data to keep in memory" inline>
                  <input
                    type="number"
                    value={settings.mouseBufferMinutes}
                    onChange={e => updateField('mouseBufferMinutes', parseInt(e.target.value, 10) || 5)}
                    className="w-20 px-2 py-1 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent text-center"
                    min={1}
                    max={60}
                  />
                </SettingsField>

                <SettingsField label="Max Files on Start" description="Trace files to load at startup" inline>
                  <input
                    type="number"
                    value={settings.maxExistingOnStart}
                    onChange={e => updateField('maxExistingOnStart', parseInt(e.target.value, 10) || 10)}
                    className="w-20 px-2 py-1 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent text-center"
                    min={0}
                    max={100}
                  />
                </SettingsField>
              </SettingsSection>

              <SettingsSection title="AI Features">
                <SettingsField label="Gemini API Key" description="For AI-powered session insights">
                  <div className="flex items-center gap-2 max-w-md">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.geminiApiKey || ''}
                        onChange={e => updateField('geminiApiKey', e.target.value || undefined)}
                        className="w-full px-3 py-1.5 pr-9 text-sm rounded bg-surface-2 border border-primary text-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
                        placeholder="API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => BrowserOpenURL('https://aistudio.google.com/apikey')}
                      className="flex items-center gap-1 text-accent hover:underline text-xs whitespace-nowrap"
                    >
                      Get key <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </SettingsField>
              </SettingsSection>
            </div>
          )}
        </SettingsSection>

        {/* Actions Footer */}
        <div className="flex items-center gap-3 pt-4 border-t border-primary">
          <Button variant="ghost" size="sm" onClick={() => setIsResetOpen(true)}>
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsClearCacheOpen(true)}>
            Clear Cache
          </Button>
          <div className="flex-1" />
          <Button variant="danger" size="sm" onClick={() => QuitApp()}>
            Quit App
          </Button>
          <Button variant="accent" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <ResetSettingsModal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} onReset={handleReset} />
      <ClearCacheModal isOpen={isClearCacheOpen} onClose={() => setIsClearCacheOpen(false)} />
    </div>
  )
}

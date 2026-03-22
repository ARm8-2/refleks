import { Button, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components'
import { usePersistedState, useStore } from '@/shared/hooks'
import {
  FONTS,
  STORAGE_KEYS,
  THEMES,
  checkForUpdates,
  getSettings,
  getVersion,
  openURL,
  quitApp,
  setAutostart,
  setFont,
  setTheme,
  updateSettings,
  type Font,
  type Theme,
} from '@/shared/lib'
import type { Settings, UpdateInfo } from '@/shared/types'
import { ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ClearCacheModal } from '../components/ClearCacheModal'
import { ResetSettingsModal } from '../components/ResetSettingsModal'
import { SettingsField } from '../components/SettingsField'
import { SettingsSection } from '../components/SettingsSection'

const MISSING_STR = 'N/A'
const themeOptions = THEMES.map(t => ({ label: t, value: t }))
const fontOptions = FONTS.map(f => ({ label: f.label, value: f.id }))
const sessionGapOptions = [5, 10, 15, 20, 30, 45, 60, 90, 120].map(m => ({
  label: `${m} minutes`,
  value: String(m),
}))

export function SettingsPage() {
  const setSessionGap = useStore(s => s.setSessionGap)
  const setSessionNotes = useStore(s => s.setSessionNotes)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [showAdvanced, setShowAdvanced] = usePersistedState(STORAGE_KEYS.settingsShowAdvanced, false)
  const saveQueueRef = useRef(Promise.resolve())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Updates state
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState<boolean>(false)
  const [checkError, setCheckError] = useState<string>('')
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => { })
    getVersion()
      .then(v => setCurrentVersion(v))
      .catch(() => setCurrentVersion(''))
  }, [])

  const queueSettingsSave = (next: Settings) => {
    setIsSaving(true)
    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        await updateSettings(next)
        setSessionGap(next.sessionGapMinutes)
        setSessionNotes(next.sessionNotes ?? {})
        setHasUnsavedChanges(false)
      })
      .catch((error: unknown) => {
        console.error('Save error:', error)
        alert('Failed to save settings')
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K], persist = false) => {
    setSettings(prev => {
      if (!prev) return null
      const next = { ...prev, [key]: value }
      if (persist) {
        queueSettingsSave(next)
      } else {
        setHasUnsavedChanges(true)
      }
      return next
    })
  }

  const handleAutostartChange = async (enabled: boolean) => {
    try {
      await setAutostart(enabled)
      updateField('autostartEnabled', enabled)
    } catch (e) {
      console.error('setAutostart error:', e)
      alert('Failed to update autostart: ' + (e as Error)?.message)
    }
  }

  const handleThemeChange = (value: string) => {
    const theme = value as Theme
    setTheme(theme)
    updateField('theme', theme, true)
  }

  const handleFontChange = (value: string) => {
    const font = value as Font
    setFont(font)
    updateField('font', font, true)
  }

  const handleCheckUpdate = async () => {
    setChecking(true)
    setCheckError('')
    try {
      const info = await checkForUpdates()
      setUpdate(info)
    } catch (e) {
      setCheckError((e as Error)?.message || 'Failed to check for updates')
    } finally {
      setChecking(false)
    }
  }

  const handleEnterCommit = (input?: HTMLInputElement) => {
    if (settings) {
      queueSettingsSave(settings)
      input?.blur()
    }
  }

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleEnterCommit(e.currentTarget)
  }

  const handleReset = async () => {
    try {
      const current = await getSettings()
      setSettings(current)
      setHasUnsavedChanges(false)
      setTheme(current.theme)
      if (current.font) setFont(current.font)
      setSessionGap(current.sessionGapMinutes)
      setSessionNotes(current.sessionNotes ?? {})
    } catch (e) {
      console.error('Reset error:', e)
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto text-sm">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8 max-w-2xl">
        {/* Updates */}
        <SettingsSection title="Updates">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">Current version: <span className="text-foreground font-mono">{currentVersion || MISSING_STR}</span></span>
            <Button onClick={handleCheckUpdate} disabled={checking} variant="outline" size="sm">
              {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check for Updates'}
            </Button>
            {checkError && <span className="text-destructive text-sm">{checkError}</span>}
            {update && !update.hasUpdate && (
              <span className="text-muted-foreground text-sm">You're on the latest version!</span>
            )}
          </div>
          {update?.hasUpdate && (
            <div className="bg-card rounded-xl p-4 space-y-3 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-medium">Version {update.latestVersion} available</span>
              </div>
              {update.releaseNotes && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap max-h-24 overflow-auto">
                  {update.releaseNotes}
                </p>
              )}
              <Button onClick={() => update.downloadUrl && openURL(update.downloadUrl)} variant="default" size="sm">
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </Button>
            </div>
          )}
        </SettingsSection>

        {/* General */}
        <SettingsSection title="General">
          <SettingsField label="Stats Directory" description="Path to KovaaK's stats folder">
            <Input
              type="text"
              value={settings.statsDir}
              onChange={e => updateField('statsDir', e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="w-full max-w-xl"
            />
          </SettingsField>

          <SettingsField label="Start with Windows" description="Launch RefleK's when you log in" checkbox>
            <Checkbox
              checked={!!settings.autostartEnabled}
              onCheckedChange={v => handleAutostartChange(v === true)}
            />
          </SettingsField>

          <SettingsField label="Mouse Tracking" description="Record mouse movement during scenarios (Windows only)" checkbox>
            <Checkbox
              checked={!!settings.mouseTrackingEnabled}
              onCheckedChange={v => updateField('mouseTrackingEnabled', v === true, true)}
            />
          </SettingsField>

          <SettingsField label="Session Gap" description="Minutes of inactivity before starting a new session">
            <Select value={String(settings.sessionGapMinutes)} onValueChange={v => updateField('sessionGapMinutes', parseInt(v, 10), true)}>
              <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessionGapOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingsField label="Theme" description="Color theme for the application">
            <Select value={settings.theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="Font" description="Font family for the interface">
            <Select value={settings.font || FONTS[0].id} onValueChange={handleFontChange}>
              <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection title="Advanced">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm -mt-1"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-6">
              <SettingsSection title="Steam">
                <SettingsField label="Steam Install Directory">
                  <Input
                    type="text"
                    value={settings.steamInstallDir}
                    onChange={e => updateField('steamInstallDir', e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full max-w-xl"
                  />
                </SettingsField>

                <SettingsField label="Steam ID Override" description="Leave empty to auto-detect">
                  <Input
                    type="text"
                    value={settings.steamIdOverride || ''}
                    onChange={e => updateField('steamIdOverride', e.target.value || undefined)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="76561198000000000"
                    className="w-full max-w-xs font-mono"
                  />
                </SettingsField>

                <SettingsField label="Persona Name Override" description="Leave empty to auto-detect">
                  <Input
                    type="text"
                    value={settings.personaNameOverride || ''}
                    onChange={e => updateField('personaNameOverride', e.target.value || undefined)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Display name"
                    className="w-full max-w-xs"
                  />
                </SettingsField>
              </SettingsSection>

              <SettingsSection title="Mouse Traces">
                <SettingsField label="Buffer Duration" description="Minutes of mouse data to keep in memory">
                  <Input
                    type="number"
                    value={settings.mouseBufferMinutes}
                    onChange={e => updateField('mouseBufferMinutes', parseInt(e.target.value, 10) || 5)}
                    onKeyDown={handleInputKeyDown}
                    min={1}
                    max={60}
                    className="w-20 text-center"
                  />
                </SettingsField>

                <SettingsField label="Recent Runs Window (Days)" description="Only runs from the last N days are loaded and shown">
                  <Input
                    type="number"
                    value={settings.recentRunsDays}
                    onChange={e => {
                      const next = parseInt(e.target.value, 10)
                      updateField('recentRunsDays', Number.isFinite(next) && next > 0 ? next : settings.recentRunsDays)
                    }}
                    onKeyDown={handleInputKeyDown}
                    min={1}
                    max={3650}
                    className="w-24 text-center"
                  />
                </SettingsField>

                <SettingsField label="Recent Runs Minimum Count" description="If the day window has too few runs, include older runs until this minimum is reached">
                  <Input
                    type="number"
                    value={settings.recentRunsMinCount}
                    onChange={e => {
                      const next = parseInt(e.target.value, 10)
                      updateField('recentRunsMinCount', Number.isFinite(next) && next > 0 ? next : settings.recentRunsMinCount)
                    }}
                    onKeyDown={handleInputKeyDown}
                    min={1}
                    max={50000}
                    className="w-24 text-center"
                  />
                </SettingsField>
              </SettingsSection>
            </div>
          )}
        </SettingsSection>

        {/* Actions Footer */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => setIsResetOpen(true)}>
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsClearCacheOpen(true)}>
            Clear Cache
          </Button>
          <span className="text-xs text-muted-foreground">
            {isSaving ? 'Saving settings...' : hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <div className="flex-1" />
          <Button variant="default" size="sm" onClick={() => handleEnterCommit()} disabled={isSaving || !settings}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => quitApp()}>
            Quit App
          </Button>
        </div>
      </div>

      <ResetSettingsModal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} onReset={handleReset} />
      <ClearCacheModal isOpen={isClearCacheOpen} onClose={() => setIsClearCacheOpen(false)} />
    </div>
  )
}

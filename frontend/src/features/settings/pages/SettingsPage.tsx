import {
  WelcomeModal,
  buildManualWelcomePresentation,
  buildWelcomeSeenSettingsUpdate,
  buildWelcomeSettingsUpdate,
  type WelcomePresentation,
} from '@/features/welcome'
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

  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState<boolean>(false)
  const [checkError, setCheckError] = useState<string>('')
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false)
  const [welcomePresentation, setWelcomePresentation] = useState<WelcomePresentation | null>(null)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => { })
    getVersion()
      .then(v => setCurrentVersion(v))
      .catch(() => setCurrentVersion(''))
  }, [])

  const queueSettingsSave = (next: Settings) => {
    setIsSaving(true)
    const run = saveQueueRef.current.then(async () => {
      await updateSettings(next)
      setSessionGap(next.sessionGapMinutes)
      setSessionNotes(next.sessionNotes ?? {})
      setHasUnsavedChanges(false)
    })
      .catch((error: unknown) => {
        console.error('Save error:', error)
        alert('Failed to save settings')
        throw error
      })
      .finally(() => {
        setIsSaving(false)
      })

    saveQueueRef.current = run.catch(() => { })
    return run
  }

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K], persist = false) => {
    setSettings(prev => {
      if (!prev) return null
      const next = { ...prev, [key]: value }
      if (persist) {
        void queueSettingsSave(next)
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

  const handleOpenWelcome = () => {
    if (!settings) return

    const nextPresentation = buildManualWelcomePresentation(settings, currentVersion)
    if (!nextPresentation) return

    setWelcomePresentation(nextPresentation)
  }

  const handleWelcomeConfirm = async ({ anonymousEnabled, mouseTrackingEnabled }: { anonymousEnabled: boolean, mouseTrackingEnabled: boolean | null }) => {
    if (!settings || !welcomePresentation) return

    const next = buildWelcomeSeenSettingsUpdate(
      buildWelcomeSettingsUpdate(settings, { anonymousEnabled, mouseTrackingEnabled }),
      welcomePresentation.currentVersion,
    )
    setSettings(next)
    try {
      await queueSettingsSave(next)
      setWelcomePresentation(null)
    } catch {
      // queueSettingsSave already surfaced the failure to the user.
    }
  }

  const handleAnonymousChange = (enabled: boolean) => {
    setSettings(prev => {
      if (!prev) return null
      const next = {
        ...prev,
        anonymousEnabled: enabled,
      }
      void queueSettingsSave(next)
        .catch(() => { })
      return next
    })
  }

  const handleEnterCommit = (input?: HTMLInputElement) => {
    if (settings) {
      void queueSettingsSave(settings)
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
      <div className="flex h-full flex-col overflow-hidden text-sm">
        <div className="p-5 text-surface-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-sm">
      <div className="sticky top-0 z-10 bg-canvas/95 px-5 py-4 backdrop-blur">
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-surface-muted-foreground">General behavior, privacy, appearance, and advanced integration options.</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          <SettingsSection title="Updates" description="Check for the latest version, reopen the welcome screen, and review the current release.">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-surface-muted-foreground">
                Current version: <span className="font-mono text-foreground">{currentVersion || MISSING_STR}</span>
              </span>
              <Button onClick={handleCheckUpdate} disabled={checking} variant="outline" size="sm">
                {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Check for Updates'}
              </Button>
              <Button onClick={handleOpenWelcome} disabled={!currentVersion.trim()} variant="outline" size="sm">
                Read Welcome Again
              </Button>
              {checkError && <span className="text-sm text-destructive">{checkError}</span>}
              {update && !update.hasUpdate && (
                <span className="text-sm text-surface-muted-foreground">You're on the latest version!</span>
              )}
            </div>
            {update?.hasUpdate && (
              <div className="space-y-3 rounded-xl bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Version {update.latestVersion} available</span>
                </div>
                {update.releaseNotes && (
                  <p className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-surface-muted-foreground">
                    {update.releaseNotes}
                  </p>
                )}
                <Button onClick={() => update.downloadUrl && openURL(update.downloadUrl)} variant="default" size="sm">
                  <Download className="mr-1.5 h-4 w-4" />
                  Download
                </Button>
              </div>
            )}
          </SettingsSection>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <SettingsSection title="General" description="Core folders and session behavior.">
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
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionGapOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>
              </SettingsSection>

              <SettingsSection title="Privacy" description="Control whether runs are uploaded and whether identifying environment data is scrubbed before sync.">
                <SettingsField label="Run Sync" description="Upload completed runs to the RefleK's Index." checkbox>
                  <Checkbox
                    checked={settings.runSyncEnabled !== false}
                    onCheckedChange={v => updateField('runSyncEnabled', v === true, true)}
                  />
                </SettingsField>

                <SettingsField label="Anonymous Mode" description="Remove Steam ID, Steam persona name, and hostname from run environment data before sync uploads." checkbox>
                  <Checkbox
                    checked={settings.anonymousEnabled === true}
                    onCheckedChange={v => handleAnonymousChange(v === true)}
                  />
                </SettingsField>
              </SettingsSection>
            </div>

            <div className="space-y-4">
              <SettingsSection title="Appearance" description="Visual preferences for the interface.">
                <SettingsField label="Theme" description="Color theme for the application">
                  <Select value={settings.theme} onValueChange={handleThemeChange}>
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>

                <SettingsField label="Font" description="Font family for the interface">
                  <Select value={settings.font || FONTS[0].id} onValueChange={handleFontChange}>
                    <SelectTrigger className="h-8 w-max min-w-[8rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsField>
              </SettingsSection>

              <SettingsSection title="Advanced" description="Integration and data retention options.">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-sm text-surface-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">Steam</div>
                      <div className="space-y-4">
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
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">Mouse Traces</div>
                      <div className="space-y-4">
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
                      </div>
                    </div>
                  </div>
                )}
              </SettingsSection>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setIsResetOpen(true)}>
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsClearCacheOpen(true)}>
              Clear Cache
            </Button>
            <span className="text-xs text-surface-muted-foreground">
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
      </div>

      <ResetSettingsModal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} onReset={handleReset} />
      <ClearCacheModal isOpen={isClearCacheOpen} onClose={() => setIsClearCacheOpen(false)} />
      {welcomePresentation && (
        <WelcomeModal
          isOpen
          content={welcomePresentation.content}
          initialAnonymousEnabled={welcomePresentation.initialAnonymousEnabled}
          initialMouseTrackingEnabled={welcomePresentation.initialMouseTrackingEnabled}
          showMouseTraceChoice={welcomePresentation.showMouseTraceChoice}
          runSyncEnabled={welcomePresentation.runSyncEnabled}
          onConfirm={handleWelcomeConfirm}
          onClose={() => setWelcomePresentation(null)}
        />
      )}
    </div>
  )
}

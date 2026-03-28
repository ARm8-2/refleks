import { getSettings, getVersion, updateSettings } from '@/shared/lib'
import { useEffect, useState } from 'react'
import { buildVersionWelcomePresentation, buildWelcomeSeenSettingsUpdate, buildWelcomeSettingsUpdate, type WelcomePresentation } from '../lib/presentation'
import { WelcomeModal } from './WelcomeModal'

export function VersionWelcomeGate() {
  const [presentation, setPresentation] = useState<WelcomePresentation | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.all([getSettings(), getVersion()])
      .then(([settings, version]) => {
        if (cancelled) return

        const nextPresentation = buildVersionWelcomePresentation(settings, version)
        if (!nextPresentation) return

        setPresentation(nextPresentation)
      })
      .catch(error => {
        console.warn('Failed to resolve welcome modal state:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleClose = () => {
    if (!presentation) {
      return
    }

    setPresentation(null)

    void getSettings()
      .then(settings => updateSettings(buildWelcomeSeenSettingsUpdate(settings, presentation.currentVersion)))
      .catch(error => {
        console.warn('Failed to persist welcome dismissal:', error)
      })
  }

  const handleConfirm = async ({ anonymousEnabled, mouseTrackingEnabled }: { anonymousEnabled: boolean, mouseTrackingEnabled: boolean | null }) => {
    if (!presentation) {
      return
    }

    try {
      const settings = await getSettings()
      const nextSettings = buildWelcomeSeenSettingsUpdate(
        buildWelcomeSettingsUpdate(settings, { anonymousEnabled, mouseTrackingEnabled }),
        presentation.currentVersion,
      )
      await updateSettings(nextSettings)
      setPresentation(null)
    } catch (error) {
      console.warn('Failed to save welcome choice:', error)
    }
  }

  if (!presentation) {
    return null
  }

  return (
    <WelcomeModal
      isOpen
      content={presentation.content}
      initialAnonymousEnabled={presentation.initialAnonymousEnabled}
      initialMouseTrackingEnabled={presentation.initialMouseTrackingEnabled}
      showMouseTraceChoice={presentation.showMouseTraceChoice}
      runSyncEnabled={presentation.runSyncEnabled}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  )
}
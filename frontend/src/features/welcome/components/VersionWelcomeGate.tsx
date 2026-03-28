import { getSettings, getVersion, updateSettings } from '@/shared/lib'
import type { Settings } from '@/shared/types'
import { useEffect, useState } from 'react'
import { resolveWelcomeContent, type WelcomeContent } from '../lib/content'
import { WelcomeModal } from './WelcomeModal'

export function VersionWelcomeGate() {
  const [content, setContent] = useState<WelcomeContent | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.all([getSettings(), getVersion()])
      .then(([settings, version]) => {
        if (cancelled) return

        const currentVersion = version.trim()
        if (currentVersion === '') return

        const previousVersion = settings.lastSeenVersion?.trim() ?? ''
        if (previousVersion === currentVersion) return

        setContent(resolveWelcomeContent(currentVersion, previousVersion))

        const nextSettings: Settings = {
          ...settings,
          lastSeenVersion: currentVersion,
        }

        void updateSettings(nextSettings).catch(error => {
          console.warn('Failed to persist last seen version:', error)
        })
      })
      .catch(error => {
        console.warn('Failed to resolve welcome modal state:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!content) {
    return null
  }

  return <WelcomeModal isOpen content={content} onClose={() => setContent(null)} />
}
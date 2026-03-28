export type WelcomeContent = {
  title: string
  badge: string
  intro: string
  highlights: string[]
  ctaLabel: string
}

type ReleaseCopy = {
  summary: string
  highlights: string[]
}

// Add per-version welcome copy here when shipping a new release.
const RELEASE_COPY: Record<string, ReleaseCopy> = {
  '0.7.0': {
    summary: 'This release tightens privacy around synced uploads and adds a lightweight in-app welcome flow for new installs and updates.',
    highlights: [
      'Anonymous Mode now strips Steam ID, persona name, and hostname before synced uploads leave your machine.',
      'The app can now show a short welcome or upgrade summary the first time a version is launched.',
      'Settings still remain the place to review privacy controls and manually check for updates.',
    ],
  },
}

const DEFAULT_RELEASE_COPY: ReleaseCopy = {
  summary: 'This build includes fixes and refinements across tracking, settings, and the desktop experience.',
  highlights: [
    'RefleK\'s will keep showing a short summary the first time you launch a new version.',
    'Version-specific notes live in one place so future release messaging stays easy to maintain.',
    'You can always review update status later from the Settings page.',
  ],
}

export function resolveWelcomeContent(currentVersion: string, previousVersion: string): WelcomeContent {
  const trimmedCurrent = currentVersion.trim()
  const trimmedPrevious = previousVersion.trim()
  const isFirstLaunch = trimmedPrevious === ''
  const releaseCopy = RELEASE_COPY[trimmedCurrent] ?? DEFAULT_RELEASE_COPY

  return {
    title: isFirstLaunch ? 'Welcome to RefleK\'s' : `What\'s New in ${trimmedCurrent}`,
    badge: isFirstLaunch ? `Version ${trimmedCurrent}` : `${trimmedPrevious} -> ${trimmedCurrent}`,
    intro: isFirstLaunch
      ? `Thanks for installing RefleK\'s. ${releaseCopy.summary}`
      : `You\'ve updated to ${trimmedCurrent}. ${releaseCopy.summary}`,
    highlights: releaseCopy.highlights,
    ctaLabel: isFirstLaunch ? 'Start exploring' : 'Continue',
  }
}
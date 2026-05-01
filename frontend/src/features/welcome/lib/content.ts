import { EXTERNAL_LINKS } from '@/shared/lib'

export type WelcomeContent = {
  title: string
  intro: string
  details: string[]
  highlightsTitle: string
  highlights: string[]
  linksTitle: string
  links: WelcomeLink[]
  ctaLabel: string
}

export type WelcomeLink = {
  label: string
  description: string
  url: string
  urlLabel: string
}

type ReleaseCopy = {
  details: string[]
  highlights: string[]
}

const APP_REFRESH_COPY: ReleaseCopy = {
  details: [
    'We\'re introducing an Overview page and a History page to make it easier to move between sessions and runs. The frontend has been rebuilt with a cleaner layout and more consistent components, and the desktop app underneath now runs faster and more reliably.',
  ],
  highlights: [
    'A redesigned UI with reworked layouts, components, and theme treatment across the desktop app.',
    'A new Overview page for quick progress checks and a richer History flow for sessions and runs.',
    'Cleaner navigation between the main parts of the app.',
    'Under-the-hood improvements that make the app faster, lighter, and smoother to use.',
  ],
}

const RESOURCE_LINKS: WelcomeLink[] = [
  {
    label: 'Browse the docs',
    description: 'Setup guides, walkthroughs, and troubleshooting for the newer RefleK\'s experience.',
    url: EXTERNAL_LINKS.docs,
    urlLabel: 'refleksapp.com/docs/',
  },
  {
    label: 'Read the changelog',
    description: 'See the fuller release history and version-by-version notes in the browser.',
    url: EXTERNAL_LINKS.changelog,
    urlLabel: 'refleksapp.com/changelog/',
  },
]

export function resolveWelcomeContent(currentVersion: string, previousVersion: string): WelcomeContent {
  const trimmedCurrent = currentVersion.trim()
  const trimmedPrevious = previousVersion.trim()
  const isFirstLaunch = trimmedPrevious === ''

  return {
    title: isFirstLaunch
      ? `Welcome to RefleK\'s v${trimmedCurrent}`
      : `Welcome back to RefleK\'s v${trimmedCurrent}`,
    intro: isFirstLaunch
      ? 'Thank you for installing RefleK\'s. This release is a major refresh for RefleK\'s, with much of the UI and supporting app code reworked, and it should feel more complete from the moment you open it.'
      : 'Welcome back. This release is a major refresh for RefleK\'s, with much of the UI and supporting app code reworked, and it should feel more complete from the moment you open it.',
    details: APP_REFRESH_COPY.details,
    highlightsTitle: 'What\'s New',
    highlights: APP_REFRESH_COPY.highlights,
    linksTitle: 'Docs and Changelog',
    links: RESOURCE_LINKS,
    ctaLabel: isFirstLaunch ? 'Start exploring' : 'Jump back in',
  }
}

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

const RESOURCE_LINKS: WelcomeLink[] = [
  {
    label: 'Browse the docs',
    description: 'Setup guides, walkthroughs, and troubleshooting for RefleK\'s.',
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
      ? 'Thank you for installing RefleK\'s. Check out the changelog and docs to get up to speed with the latest features and improvements.'
      : 'Welcome back. Check out the changelog to see what\'s new in this release.',
    details: [
      'For detailed information about what\'s changed, features, and improvements, please visit the changelog linked below. It\'s always kept up to date with the latest release notes.',
    ],
    highlightsTitle: 'Getting Started',
    highlights: [
      'Visit the changelog for detailed release information and feature updates.',
      'Check the documentation for guides, walkthroughs, and troubleshooting.',
      'Customize your preferences in Settings to tailor RefleK\'s to your needs.',
      'Join the community and share your experience.',
    ],
    linksTitle: 'Resources',
    links: RESOURCE_LINKS,
    ctaLabel: isFirstLaunch ? 'Start exploring' : 'Jump back in',
  }
}

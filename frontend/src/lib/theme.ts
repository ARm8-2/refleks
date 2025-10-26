export const THEMES = ['dark', 'light', 'dracula', 'ocean'] as const
export type Theme = typeof THEMES[number]

const STORAGE_KEY = 'refleks.theme'

export function getSavedTheme(): Theme {
  const v = (localStorage.getItem(STORAGE_KEY) || 'dark').toLowerCase()
  return (THEMES as readonly string[]).includes(v) ? (v as Theme) : 'dark'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  // remove all known theme classes dynamically from list
  THEMES.forEach(t => root.classList.remove(`theme-${t}`))
  root.classList.add(`theme-${theme}`)
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

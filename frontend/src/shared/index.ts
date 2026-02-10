// Shared module exports
export * from './components'
export * from './hooks'
// Re-export specific items to avoid conflicts
export * from './lib/api'
export { openURL } from './lib/api'
export { benchmarkPath } from './lib/navigation'
export {
  applyFont,
  applyTheme, colorWithAlpha,
  cssColorToRGB, DEFAULT_FONT, DEFAULT_THEME, FONT_CHANGED_EVENT, FONTS, getCssVar, getFontStack, getSavedFont,
  getSavedTheme,
  setFont,
  setTheme, THEME_CHANGED_EVENT, THEMES
} from './lib/theme'
export type { Font, Theme } from './lib/theme'
export * from './types/domain'
export type {
  Benchmark, BenchmarkDifficulty, BenchmarkProgress, KovaaksLastScore, KovaaksScoreAttributes, MousePoint, ProgressCategory, ProgressGroup, ProgressScenario, RankDef, ScenarioNote, ScenarioRecord, SessionNote, Settings, UpdateInfo
} from './types/ipc'

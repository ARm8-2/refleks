// Shared module exports
export * from './components'
export * from './hooks'
// Re-export specific items to avoid conflicts
export * from './lib/api'
export {
  DEFAULT_FONT, DEFAULT_THEME, FONTS, FONT_CHANGED_EVENT, THEMES, THEME_CHANGED_EVENT, applyFont,
  applyTheme, colorWithAlpha,
  cssColorToRGB, getCssVar, getFontStack, getSavedFont,
  getSavedTheme,
  setFont,
  setTheme
} from './lib/theme'
export type { Font, Theme } from './lib/theme'
export * from './types/domain'
export type {
  Benchmark, BenchmarkDifficulty, BenchmarkProgress, KovaaksLastScore, KovaaksScoreAttributes, MousePoint, ProgressCategory, ProgressGroup, ProgressScenario, RankDef, ScenarioNote, ScenarioRecord, SessionNote, Settings, UpdateInfo
} from './types/ipc'

import { useSyncExternalStore } from 'react'
import { THEME_CHANGED_EVENT, colorWithAlpha, getCssVar } from '../lib/theme'

export type ChartTheme = {
  textPrimary: string
  textSecondary: string
  grid: string
  tooltipBg: string
  tooltipBorder: string
  accent: string
  accentSoft: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  neutral: string
  neutralSoft: string
  contrast: string
}

const FALLBACK: ChartTheme = {
  textPrimary: 'rgba(255,255,255,0.9)',
  textSecondary: 'rgba(255,255,255,0.7)',
  grid: 'rgba(255,255,255,0.06)',
  tooltipBg: 'rgba(17,24,39,0.95)',
  tooltipBorder: 'rgba(255,255,255,0.1)',
  accent: '#3b82f6',
  accentSoft: 'rgba(59,130,246,0.25)',
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.2)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245,158,11,0.22)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.22)',
  neutral: '#94a3b8',
  neutralSoft: 'rgba(148,163,184,0.2)',
  contrast: '#ffffff'
}

let cachedTheme: ChartTheme = FALLBACK

function isSameTheme(a: ChartTheme, b: ChartTheme) {
  return a.textPrimary === b.textPrimary
    && a.textSecondary === b.textSecondary
    && a.grid === b.grid
    && a.tooltipBg === b.tooltipBg
    && a.tooltipBorder === b.tooltipBorder
    && a.accent === b.accent
    && a.accentSoft === b.accentSoft
    && a.success === b.success
    && a.successSoft === b.successSoft
    && a.warning === b.warning
    && a.warningSoft === b.warningSoft
    && a.danger === b.danger
    && a.dangerSoft === b.dangerSoft
    && a.neutral === b.neutral
    && a.neutralSoft === b.neutralSoft
    && a.contrast === b.contrast
}

function resolve(): ChartTheme {
  const textPrimary = getCssVar('--text-primary', FALLBACK.textPrimary)
  const textSecondary = getCssVar('--text-secondary', FALLBACK.textSecondary)
  const grid = getCssVar('--chart-grid', FALLBACK.grid)
  const tooltipBg = getCssVar('--chart-tooltip-bg', getCssVar('--bg-tertiary', FALLBACK.tooltipBg))
  const tooltipBorder = getCssVar('--chart-tooltip-border', FALLBACK.tooltipBorder)

  const accent = getCssVar('--chart-accent', getCssVar('--accent-primary', FALLBACK.accent))
  const success = getCssVar('--chart-success', getCssVar('--success', FALLBACK.success))
  const warning = getCssVar('--chart-warning', getCssVar('--warning', FALLBACK.warning))
  const danger = getCssVar('--chart-danger', getCssVar('--error', FALLBACK.danger))
  const neutral = getCssVar('--chart-neutral', FALLBACK.neutral)
  const contrast = getCssVar('--chart-contrast', FALLBACK.contrast)

  const next: ChartTheme = {
    textPrimary,
    textSecondary,
    grid,
    tooltipBg,
    tooltipBorder,
    accent,
    accentSoft: colorWithAlpha(accent, 0.25, FALLBACK.accentSoft),
    success,
    successSoft: colorWithAlpha(success, 0.2, FALLBACK.successSoft),
    warning,
    warningSoft: colorWithAlpha(warning, 0.22, FALLBACK.warningSoft),
    danger,
    dangerSoft: colorWithAlpha(danger, 0.22, FALLBACK.dangerSoft),
    neutral,
    neutralSoft: colorWithAlpha(neutral, 0.2, FALLBACK.neutralSoft),
    contrast,
  }

  if (isSameTheme(next, cachedTheme)) return cachedTheme
  cachedTheme = next
  return cachedTheme
}

function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => { }
  const handler = () => cb()
  window.addEventListener(THEME_CHANGED_EVENT, handler)
  // Also refresh when storage theme changes (e.g., another tab)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(THEME_CHANGED_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

/**
 * Resolve chart theme colors from CSS variables with live updates when the
 * theme changes. Safe for SSR via a fallback snapshot.
 */
export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, resolve, () => FALLBACK)
}

import { useMemo } from 'react'

export type ChartTheme = {
  textPrimary: string
  textSecondary: string
  grid: string
  tooltipBg: string
  tooltipBorder: string
}

/**
 * Resolve chart theme colors from CSS variables with SSR-safe fallbacks.
 * Centralizes styling so all charts look consistent and themeable.
 */
export function useChartTheme(): ChartTheme {
  return useMemo<ChartTheme>(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return {
        textPrimary: 'rgba(255,255,255,0.9)',
        textSecondary: 'rgba(255,255,255,0.7)',
        grid: 'rgba(255,255,255,0.06)',
        tooltipBg: 'rgba(17,24,39,0.95)',
        tooltipBorder: 'rgba(255,255,255,0.1)'
      }
    }
    const css = getComputedStyle(document.documentElement)
    const get = (name: string, fb: string) => (css.getPropertyValue(name).trim() || fb)
    return {
      textPrimary: get('--text-primary', 'rgba(255,255,255,0.9)'),
      textSecondary: get('--text-secondary', 'rgba(255,255,255,0.7)'),
      grid: 'rgba(255,255,255,0.06)',
      tooltipBg: get('--bg-tertiary', 'rgba(17,24,39,0.95)'),
      tooltipBorder: 'rgba(255,255,255,0.1)'
    }
  }, [])
}

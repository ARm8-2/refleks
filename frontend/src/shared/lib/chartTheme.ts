export const CHART_SERIES_COLORS = {
  scoreCurrent: 'var(--chart-1)',
  scoreHistory: 'var(--chart-2)',
  accuracy: 'var(--chart-3)',
  ttk: 'var(--chart-4)',
  compare: 'var(--chart-5)',
  neutral: 'var(--surface-muted-foreground)',
} as const

export const CHART_STYLE = {
  linePrimaryWidth: 2.25,
  lineSecondaryWidth: 1.5,
  lineAccentWidth: 1.75,
  lineDash: '4 3',
  referenceDash: '6 3',
  pointRadius: 2.5,
  pointRadiusCompact: 2,
  pointRadiusSmall: 1.5,
  activePointRadius: 4,
  activePointRadiusLarge: 5,
  scatterPointRadius: 3,
} as const

export function chartDot(color: string, radius: number = CHART_STYLE.pointRadius) {
  return { r: radius, fill: color, strokeWidth: 0 }
}

export function chartActiveDot(radius: number = CHART_STYLE.activePointRadius) {
  return { r: radius }
}

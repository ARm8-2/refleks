export const MISSING_STR = 'N/A'

export const DEFAULT_BENCHMARK_CATEGORY = 'Other'

export const BENCHMARK_CATEGORY_ABBREVIATIONS: Record<string, string[]> = {
  'Aim Groups': ['VT', 'rA', 'xyz', 'A+', 'cAt', 'CB', 'MIR', 'STR', 'JP', 'cA', 'STK', 'TSK', 'RXZU'],
  'Community Benchmarks': ['AQ!', 'AOI', 'e', 'roa', 'AS', 'ATB', 'ATF', 'cR', 'DM', 'ETB', 'GM', 'HEW', 'mHb', 'pA', 'PG', 'sA', 'R&G', 'RBE', 'rxn', 'Ssb', 'TNT', 'TZY', 'VR', 'pnv1', 'SFB'],
  'Notable Creator Benchmarks': ['A', 'w', 'TPT', 'm', 'M', 'WH', 'V', 'D&R', 'MH', 'LEM']
}

// Common chart formatting decimal defaults
export const CHART_DECIMALS = {
  pctTick: 0 as const,
  pctTooltip: 1 as const,
  numTick: 0 as const,
  numTooltip: 0 as const,
  ttkTick: 1 as const,
  ttkTooltip: 3 as const,
  sensTick: 2 as const,
  sensTooltip: 2 as const,
  kpmTick: 0 as const,
  kpmTooltip: 1 as const,
  detailNum: 3 as const,
  timeTick: 0 as const,
  timeTooltip: 2 as const,
}

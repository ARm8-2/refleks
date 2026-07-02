export type InspectorTab = 'stats' | 'analysis' | 'trace' | 'environment'

export const INSPECTOR_TABS: Array<{ value: InspectorTab; label: string }> = [
  { value: 'stats', label: 'Stats' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'trace', label: 'Trace' },
  { value: 'environment', label: 'Environment' },
]

import type { ScenarioRecord } from '../types/ipc';

export function getScenarioName(it: ScenarioRecord | { fileName?: string; stats?: Record<string, any> }): string {
  const stats = (it as any).stats as Record<string, any> | undefined
  const direct = stats?.['Scenario']
  if (typeof direct === 'string' && direct.trim().length > 0) return direct
  const fn = (it as any).fileName as string | undefined
  if (typeof fn === 'string' && fn.includes(' - ')) return fn.split(' - ')[0]
  return String(direct ?? fn ?? '')
}

import type { ScenarioRecord } from './ipc'

export interface Session {
  id: string
  start: string // ISO timestamp of first scenario in session
  end: string   // ISO timestamp of last scenario
  items: ScenarioRecord[]
  name?: string
  notes?: string
}

export type BenchmarkListItem = {
  id: string
  title: string
  abbreviation: string
  subtitle?: string
  color?: string
  dateAdded?: string
}

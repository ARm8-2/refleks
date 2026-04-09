import type { RunRecord } from './ipc'

export interface Session {
  id: string
  start: string // ISO timestamp of first run in session
  end: string   // ISO timestamp of last run in session
  items: RunRecord[]
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

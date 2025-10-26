import type { ScenarioRecord } from './ipc'

export interface Session {
  id: string
  start: string // ISO timestamp of first scenario in session
  end: string   // ISO timestamp of last scenario
  items: ScenarioRecord[]
}

export type Point = { ts: any; x: number; y: number }
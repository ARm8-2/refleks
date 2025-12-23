export type MousePoint = {
  ts: number
  x: number
  y: number
  buttons?: number
}

export interface ScenarioRecord {
  filePath: string
  fileName: string
  stats: Record<string, any>
  events: string[][]
  mouseTrace?: Array<MousePoint>
  traceData?: string
  hasTrace?: boolean
}

export interface BenchmarkDifficulty {
  difficultyName: string
  kovaaksBenchmarkId: number
  sharecode: string
}

export interface Benchmark {
  benchmarkName: string
  rankCalculation: string
  abbreviation: string
  color: string
  spreadsheetURL: string
  dateAdded?: string
  difficulties: BenchmarkDifficulty[]
}

export interface RankDef {
  name: string
  color: string
}

export interface ProgressScenario {
  name: string
  score: number
  scenarioRank: number
  thresholds: number[]
  energy?: number
}

export interface ProgressGroup {
  name?: string
  color?: string
  scenarios: ProgressScenario[]
  energy?: number
}

export interface ProgressCategory {
  name: string
  color?: string
  groups: ProgressGroup[]
}

export interface BenchmarkProgress {
  overallRank: number
  benchmarkProgress: number
  ranks: RankDef[]
  categories: ProgressCategory[]
}

import type { Font, Theme } from '../lib/theme'

export interface Settings {
  steamInstallDir?: string
  steamIdOverride?: string
  personaNameOverride?: string
  statsDir: string
  tracesDir: string
  sessionGapMinutes: number
  theme: Theme
  font: Font
  favoriteBenchmarks?: string[]
  mouseTrackingEnabled?: boolean
  mouseBufferMinutes?: number
  maxExistingOnStart?: number
  autostartEnabled?: boolean
  geminiApiKey?: string
  scenarioNotes?: Record<string, ScenarioNote>
  sessionNotes?: Record<string, SessionNote>
}

export interface ScenarioNote {
  notes: string
  sens: string
}

export interface SessionNote {
  name: string
  notes: string
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  downloadUrl?: string
  releaseNotes?: string
}

export interface KovaaksScoreAttributes {
  score: number
  challengeStart: string
}

export interface KovaaksLastScore {
  id: string
  type: string
  attributes: KovaaksScoreAttributes
}

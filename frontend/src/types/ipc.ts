export type Point = {
  ts: any
  x: number
  y: number
  buttons?: number
}

export interface ScenarioRecord {
  filePath: string
  fileName: string
  stats: Record<string, any>
  events: string[][]
  mouseTrace?: Array<Point>
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
}

export interface ProgressGroup {
  name?: string
  color?: string
  scenarios: ProgressScenario[]
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

import type { Theme } from '../lib/theme'

export interface Settings {
  steamInstallDir?: string
  steamIdOverride?: string
  statsDir: string
  tracesDir: string
  sessionGapMinutes: number
  theme: Theme
  favoriteBenchmarks?: string[]
  mouseTrackingEnabled?: boolean
  mouseBufferMinutes?: number
  maxExistingOnStart?: number
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  downloadUrl?: string
  releaseNotes?: string
}

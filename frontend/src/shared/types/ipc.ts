export type MousePoint = {
  ts: number
  x: number
  y: number
  buttons?: number
}

/**
 * Known stat keys from Kovaak's CSV stats files.
 *
 * All fields are optional because different scenarios/game versions
 * may produce different subsets. The index signature allows for any
 * additional keys that future game versions may introduce.
 */
export interface ScenarioStats {
  // Overview
  'Score'?: number
  'Kills'?: number
  'Deaths'?: number
  'Accuracy'?: number
  'Hit Count'?: number
  'Miss Count'?: number

  // Damage
  'Damage Done'?: number
  'Damage Taken'?: number
  'Total Overshots'?: number

  // Timing
  'Fight Time'?: number
  'Time Remaining'?: number
  'Avg TTK'?: number
  'Real Avg TTK'?: number
  'Duration'?: number
  'Scenario Time'?: number
  'Time'?: number
  'Challenge Start'?: string
  'Pause Count'?: number
  'Pause Duration'?: number

  // Controls
  'Sens Scale'?: string
  'Sens Increment'?: number
  'Horiz Sens'?: number
  'Vert Sens'?: number
  'DPI'?: number
  'cm/360'?: number

  // Display
  'FOV'?: number
  'FOVScale'?: string
  'Resolution'?: string
  'Resolution Scale'?: number
  'Hide Gun'?: string
  'Crosshair'?: string
  'Crosshair Scale'?: number
  'Crosshair Color'?: string

  // Technical
  'Input Lag'?: number
  'Max FPS (config)'?: number
  'Avg FPS'?: number

  // Game information
  'Scenario'?: string
  'Hash'?: string
  'Game Version'?: string
  'Date Played'?: string
  'Distance Traveled'?: number
  'MBS Points'?: number

  // Additional
  'Midairs'?: number
  'Midaired'?: number
  'Directs'?: number
  'Directed'?: number
  'Reloads'?: number
  'Avg Target Scale'?: number
  'Avg Time Dilation'?: number

  // Index signature for unknown/future stats
  [key: string]: string | number | undefined
}

/** Union of all known stat keys. Use to type-check stat key references at compile time. */
export type StatKey = keyof {
  [K in keyof ScenarioStats as string extends K ? never : K]: unknown
}

export interface ScenarioRecord {
  filePath: string
  fileName: string
  stats: ScenarioStats
  events: string[][]
  env: RunEnvironment
  hasTrace: boolean
}

export interface RunEnvironment {
  appVersion: string
  os: string
  arch: string
  osVersion: string
  steamId: string
  personaName: string

  cpuName: string
  cpuCores: number
  gpuName: string
  ramTotalMB: number

  displayHz: number
  screenWidth: number
  screenHeight: number
  isWindowed: boolean

  mouseName: string
  mouseVid: string
  mousePid: string
  mouseMi: string
  mouseBackend: string

  tracePoints: number
  traceDuration: number
  sampleRate: number
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
  lastSeenVersion?: string
  statsDir: string
  sessionGapMinutes: number
  recentRunsDays: number
  recentRunsMinCount: number
  theme: Theme
  font: Font
  favoriteBenchmarks?: string[]
  mouseTrackingEnabled?: boolean
  mouseBufferMinutes?: number
  autostartEnabled?: boolean
  anonymousEnabled?: boolean
  runSyncEnabled?: boolean
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

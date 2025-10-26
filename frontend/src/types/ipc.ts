export interface ScenarioRecord {
  filePath: string
  fileName: string
  stats: Record<string, any>
  events: string[][]
  mouseTrace?: Array<{ ts: string; x: number; y: number }>
}

export interface BenchmarkDifficulty {
  difficultyName: string
  kovaaksBenchmarkId: number
  sharecode?: string
  rankColors?: Record<string, string>
  categories?: Array<Record<string, any>>
}

export interface Benchmark {
  benchmarkName: string
  rankCalculation: string
  abbreviation: string
  color: string
  spreadsheetURL: string
  difficulties: BenchmarkDifficulty[]
}

export interface Settings {
  steamInstallDir?: string
  statsDir: string
  tracesDir: string
  sessionGapMinutes: number
  theme: string
  favoriteBenchmarks?: string[]
  mouseTrackingEnabled?: boolean
  mouseBufferMinutes?: number
  maxExistingOnStart?: number
}

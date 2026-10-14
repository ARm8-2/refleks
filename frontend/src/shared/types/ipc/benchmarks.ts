export interface BenchmarkDifficulty {
  difficultyName: string;
  kovaaksBenchmarkId: number;
  sharecode: string;
}

export interface Benchmark {
  benchmarkName: string;
  rankCalculation: string;
  abbreviation: string;
  color: string;
  spreadsheetURL: string;
  dateAdded?: string;
  difficulties: BenchmarkDifficulty[];
}

export interface RankDef {
  name: string;
  color: string;
}

export interface ProgressScenario {
  name: string;
  score: number;
  scenarioRank: number;
  thresholds: number[];
  energy?: number;
}

export interface ProgressGroup {
  name?: string;
  color?: string;
  scenarios: ProgressScenario[];
  energy?: number;
}

export interface ProgressCategory {
  name: string;
  color?: string;
  groups: ProgressGroup[];
}

export interface BenchmarkProgress {
  overallRank: number;
  benchmarkProgress: number;
  ranks: RankDef[];
  categories: ProgressCategory[];
}

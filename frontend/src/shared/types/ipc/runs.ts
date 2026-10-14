export type MousePoint = {
  ts: number;
  x: number;
  y: number;
  buttons?: number;
};

export interface RunStatsData {
  summary: RunStatsSummary;
  events?: RunStatsEvent[];
}

export interface RunStatsSummary {
  score: number;
  kills: number;
  deaths: number;
  fightTime: number;
  timeRemaining: number;
  avgTtk: number;
  damageDone: number;
  totalOvershots: number;
  damageTaken: number;
  hitCount: number;
  missCount: number;
  midairs: number;
  midaired: number;
  directs: number;
  directed: number;
  reloads: number;
  distanceTraveled: number;
  mbsPoints: number;
  scenario: string;
  hash: string;
  gameVersion: string;
  challengeStart: string;
  pauseCount: number;
  pauseDuration: number;
  avgTargetScale: number;
  avgTimeDilation: number;
  inputLag: number;
  maxFpsConfig: number;
  sensScale: string;
  sensIncrement: number;
  horizSens: number;
  vertSens: number;
  dpi: number;
  fov: number;
  fovScale: string;
  hideGun: boolean;
  crosshair: string;
  crosshairScale: number;
  crosshairColor: string;
  resolution: string;
  avgFps: number;
  resolutionScale: number;
  datePlayed: string;
  accuracy: number;
  realAvgTtk: number;
  cm360: number;
  duration: number;
  scenarioTime: number;
  time: number;
}

export interface RunStatsEvent {
  killIndex: number;
  timestamp: string;
  bot: string;
  weapon: string;
  ttkSeconds: number;
  shots: number;
  hits: number;
  accuracy: number;
  damageDone: number;
  damagePossible: number;
  efficiency: number;
  cheated: boolean;
  overShots: number;
}

export type StatKey = keyof RunStatsSummary;

export interface RunRecord {
  fileVersion: number;
  filePath: string;
  fileName: string;
  stats: RunStatsData;
  performances?: RunPerformanceData;
  env: RunEnvironment;
  screenRecording?: string;
}

export interface RunPerformanceData {
  header: RunPerformanceHeader;
  events?: RunPerformanceEvent[];
}

export interface RunPerformanceHeader {
  scenarioName: string;
  scenarioHash: string;
  challengeStartUtc: number;
  schemaVersion: number;
  challengeProfile: ChallengeProfileSnapshot;
}

export interface ChallengeProfileSnapshot {
  timeLimit: number;
  playerProfile: string;
  addedBots: string[];
  playerMaxLives: number;
  botMaxLives: number[];
  playerTeam: number;
  botTeams: number[];
  mapName: string;
  mapScale: number;
  timescale: number;
  endChallengeAfterKills: number;
  endChallengeAfterDamage: number;
}

export interface RunPerformanceEvent {
  timestamp: number;
  payloadType: string;
  count?: number;
  delta?: number;
  value?: number;
}

export interface RunEnvironment {
  appVersion: string;
  os: string;
  arch: string;
  osVersion: string;
  steamId: string;
  personaName: string;

  cpuName: string;
  cpuCores: number;
  gpuName: string;
  ramTotalMB: number;

  displayHz: number;
  screenWidth: number;
  screenHeight: number;
  isWindowed: boolean;

  mouseName: string;
  mouseVid: string;
  mousePid: string;
  mouseMi: string;
  mouseBackend: string;

  tracePoints: number;
  traceDuration: number;
  sampleRate: number;
}

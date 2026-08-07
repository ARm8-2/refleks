import type {
  ReplayStatus,
  RunRecord,
  RunStatsSummary,
  Settings,
  UserMessage,
} from "@/shared/types";

const baseSummary: RunStatsSummary = {
  score: 12345.67,
  kills: 120,
  deaths: 2,
  fightTime: 45,
  timeRemaining: 15,
  avgTtk: 0.42,
  damageDone: 900,
  totalOvershots: 4,
  damageTaken: 20,
  hitCount: 350,
  missCount: 40,
  midairs: 0,
  midaired: 0,
  directs: 0,
  directed: 0,
  reloads: 2,
  distanceTraveled: 1234,
  mbsPoints: 99,
  scenario: "Long Sanitized Scenario Name For Wrapping Checks",
  hash: "fixture-hash",
  gameVersion: "fixture-version",
  challengeStart: "2026-08-07T12:00:00.000Z",
  pauseCount: 0,
  pauseDuration: 0,
  avgTargetScale: 1,
  avgTimeDilation: 1,
  inputLag: 0,
  maxFpsConfig: 240,
  sensScale: "Quake/Source",
  sensIncrement: 0.1,
  horizSens: 1,
  vertSens: 1,
  dpi: 800,
  fov: 103,
  fovScale: "Overwatch",
  hideGun: false,
  crosshair: "fixture",
  crosshairScale: 1,
  crosshairColor: "#ffffff",
  resolution: "1920x1080",
  avgFps: 240,
  resolutionScale: 1,
  datePlayed: "2026-08-07T12:00:00.000Z",
  accuracy: 0.8974,
  realAvgTtk: 0.44,
  cm360: 32.5,
  duration: 60,
  scenarioTime: 60,
  time: 60,
};

export const populatedRunFixture: RunRecord = {
  fileVersion: 1,
  filePath: "fixture/2026-08-07 Long Sanitized Scenario Name stats.csv",
  fileName: "2026-08-07 Long Sanitized Scenario Name stats.csv",
  stats: { summary: baseSummary },
  env: {
    appVersion: "fixture",
    os: "Windows",
    arch: "amd64",
    osVersion: "fixture",
    steamId: "",
    personaName: "Fixture Player",
    cpuName: "Fixture CPU",
    cpuCores: 8,
    gpuName: "Fixture GPU",
    ramTotalMB: 16384,
    displayHz: 240,
    screenWidth: 1920,
    screenHeight: 1080,
    isWindowed: false,
    mouseName: "Fixture Mouse",
    mouseVid: "",
    mousePid: "",
    mouseMi: "",
    mouseBackend: "fixture",
    tracePoints: 0,
    traceDuration: 0,
    sampleRate: 0,
  },
};

export const replayUnavailableFixture: ReplayStatus = {
  state: "unavailable",
  messageCode: "replay.unavailable",
};

export const replayProcessingFixture: ReplayStatus = {
  state: "processing",
  messageCode: "replay.processing",
};

export const replayFailedFixture: ReplayStatus = {
  state: "failed",
  messageCode: "replay.failed",
};

export const unknownMessageFixture: UserMessage = {
  messageCode: "fixture.unknown",
  messageParams: { source: "acceptance" },
};

export const persistedSettingsFixture: Settings = {
  language: "en",
  kovaaksInstallDir: "",
  sessionGapMinutes: 20,
  recentRunsDays: 180,
  recentRunsMinCount: 2500,
  theme: "dark",
  font: "montserrat",
};

export const pendingLanguageSettingsFixture: Settings = {
  ...persistedSettingsFixture,
  language: "zh-CN",
};

export const persistenceFailureFixture = new Error(
  "fixture persistence failure",
);

export const productionBoundaryFixture = {
  error: new Error("fixture private error details"),
  componentStack: "at FixturePrivateComponent",
} as const;

export const emptyHistoryFixture: RunRecord[] = [];
export const populatedHistoryFixture: RunRecord[] = [populatedRunFixture];

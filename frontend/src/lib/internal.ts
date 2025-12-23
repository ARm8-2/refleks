import {
  CancelSessionInsights as _CancelSessionInsights,
  CheckForUpdates as _CheckForUpdates,
  ClearCache as _ClearCache,
  DownloadAndInstallUpdate as _DownloadAndInstallUpdate,
  GenerateSessionInsights as _GenerateSessionInsights,
  GetAllBenchmarkProgresses as _GetAllBenchmarkProgresses,
  GetBenchmarkProgress as _GetBenchmarkProgress,
  GetBenchmarks as _GetBenchmarks,
  GetDefaultSettings as _GetDefaultSettings,
  GetFavoriteBenchmarks as _GetFavoriteBenchmarks,
  GetLastScenarioScores as _GetLastScenarioScores,
  GetRecentScenarios as _GetRecentScenarios,
  GetSettings as _GetSettings,
  GetVersion as _GetVersion,
  LaunchKovaaksPlaylist as _LaunchKovaaksPlaylist,
  LaunchKovaaksScenario as _LaunchKovaaksScenario,
  QuitApp as _QuitApp,
  RefreshAllBenchmarkProgresses as _RefreshAllBenchmarkProgresses,
  ResetSettings as _ResetSettings,
  SaveScenarioNote as _SaveScenarioNote,
  SaveSessionNote as _SaveSessionNote,
  SetAutostart as _SetAutostart,
  SetFavoriteBenchmarks as _SetFavoriteBenchmarks,
  StartWatcher as _StartWatcher,
  StopWatcher as _StopWatcher,
  UpdateSettings as _UpdateSettings
} from '../../wailsjs/go/main/App'
import type { Benchmark, BenchmarkProgress, KovaaksLastScore, ScenarioRecord, Settings, UpdateInfo } from '../types/ipc'

// Typed wrappers around Wails-generated bindings with normalized results

export async function setAutostart(enabled: boolean): Promise<void> {
  await _SetAutostart(enabled)
}

export async function quitApp(): Promise<void> {
  await _QuitApp()
}

export async function startWatcher(path = ''): Promise<void> {
  await _StartWatcher(path)
}

export async function stopWatcher(): Promise<void> {
  await _StopWatcher()
}

export async function getRecentScenarios(limit = 0): Promise<ScenarioRecord[]> {
  const res = await _GetRecentScenarios(limit)
  return (Array.isArray(res) ? res : []) as unknown as ScenarioRecord[]
}

export async function getLastScenarioScores(scenarioName: string): Promise<KovaaksLastScore[]> {
  const res = await _GetLastScenarioScores(scenarioName)
  return (Array.isArray(res) ? res : []) as unknown as KovaaksLastScore[]
}

export async function getSettings(): Promise<Settings> {
  const s = await _GetSettings()
  return s as unknown as Settings
}

export async function getDefaultSettings(): Promise<Settings> {
  const s = await _GetDefaultSettings()
  return s as unknown as Settings
}

export async function updateSettings(payload: Settings): Promise<void> {
  await _UpdateSettings(payload as any)
}

export async function resetSettings(config: boolean, favorites: boolean, scenarioNotes: boolean, sessionNotes: boolean): Promise<void> {
  await _ResetSettings(config, favorites, scenarioNotes, sessionNotes)
}

export async function saveScenarioNote(scenario: string, notes: string, sens: string): Promise<void> {
  await _SaveScenarioNote(scenario, notes, sens)
}

export async function saveSessionNote(sessionID: string, name: string, notes: string): Promise<void> {
  await _SaveSessionNote(sessionID, name, notes)
}

export async function getVersion(): Promise<string> {
  const v = await _GetVersion()
  return String(v || '')
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const info = await _CheckForUpdates()
  return info as unknown as UpdateInfo
}

export async function downloadAndInstallUpdate(version = ''): Promise<void> {
  await _DownloadAndInstallUpdate(version)
}

export async function getBenchmarks(): Promise<Benchmark[]> {
  const benchmarks = await _GetBenchmarks()
  if (!Array.isArray(benchmarks)) throw new Error('GetBenchmarks failed')
  return benchmarks as unknown as Benchmark[]
}

export async function getFavoriteBenchmarks(): Promise<string[]> {
  const ids = await _GetFavoriteBenchmarks()
  return Array.isArray(ids) ? ids : []
}

export async function setFavoriteBenchmarks(ids: string[]): Promise<void> {
  await _SetFavoriteBenchmarks(ids)
}

export async function getBenchmarkProgress(benchmarkId: number): Promise<BenchmarkProgress> {
  const data = await _GetBenchmarkProgress(benchmarkId)
  return data as unknown as BenchmarkProgress
}

export async function getAllBenchmarkProgresses(): Promise<Record<number, BenchmarkProgress>> {
  const data = await _GetAllBenchmarkProgresses()
  return data as unknown as Record<number, BenchmarkProgress>
}

export async function refreshAllBenchmarkProgresses(): Promise<Record<number, BenchmarkProgress>> {
  const data = await _RefreshAllBenchmarkProgresses()
  return data as unknown as Record<number, BenchmarkProgress>
}

// Launch a Kovaak's scenario via Steam deeplink
export async function launchScenario(name: string, mode: string = 'challenge'): Promise<void> {
  await _LaunchKovaaksScenario(String(name || ''), String(mode || 'challenge'))
}

// Launch a Kovaak's playlist via Steam deeplink using a sharecode
export async function launchPlaylist(sharecode: string): Promise<void> {
  await _LaunchKovaaksPlaylist(String(sharecode || ''))
}

export async function generateSessionInsights(sessionId: string, records: ScenarioRecord[], prompt: string, options: any): Promise<string> {
  const reqId = await _GenerateSessionInsights(String(sessionId || 'session'), records as any, String(prompt || ''), options as any)
  return String(reqId || '')
}

export async function cancelSessionInsights(requestId: string): Promise<void> {
  await _CancelSessionInsights(String(requestId || ''))
}

export async function clearCache(): Promise<void> {
  await _ClearCache()
}

export async function getScenarioTrace(fileName: string): Promise<string> {
  // Direct call to avoid build errors before Wails regenerates bindings
  return await (window as any).go.main.App.GetScenarioTrace(fileName)
}

import {
  CheckForUpdates as _CheckForUpdates,
  DownloadAndInstallUpdate as _DownloadAndInstallUpdate,
  GetBenchmarkProgress as _GetBenchmarkProgress,
  GetBenchmarks as _GetBenchmarks,
  GetDefaultSettings as _GetDefaultSettings,
  GetFavoriteBenchmarks as _GetFavoriteBenchmarks,
  GetRecentScenarios as _GetRecentScenarios,
  GetSettings as _GetSettings,
  GetVersion as _GetVersion,
  LaunchKovaaksPlaylist as _LaunchKovaaksPlaylist,
  LaunchKovaaksScenario as _LaunchKovaaksScenario,
  ResetSettings as _ResetSettings,
  SetFavoriteBenchmarks as _SetFavoriteBenchmarks,
  StartWatcher as _StartWatcher,
  StopWatcher as _StopWatcher,
  UpdateSettings as _UpdateSettings
} from '../../wailsjs/go/main/App'
import type { models } from '../../wailsjs/go/models'
import type { Benchmark, BenchmarkProgress, ScenarioRecord, Settings, UpdateInfo } from '../types/ipc'

export type { models }

// Typed wrappers around Wails-generated bindings with normalized results

export async function startWatcher(path = ''): Promise<void> {
  const res = await _StartWatcher(path)
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'StartWatcher failed')
  }
}

export async function stopWatcher(): Promise<void> {
  const res = await _StopWatcher()
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'StopWatcher failed')
  }
}

export async function getRecentScenarios(limit: number): Promise<ScenarioRecord[]> {
  const res = await _GetRecentScenarios(limit)
  return (Array.isArray(res) ? res : []) as unknown as ScenarioRecord[]
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
  const res = await _UpdateSettings(payload as unknown as models.Settings)
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'UpdateSettings failed')
  }
}

export async function resetSettings(): Promise<void> {
  const res = await _ResetSettings()
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'ResetSettings failed')
  }
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
  const res = await _DownloadAndInstallUpdate(version)
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'DownloadAndInstallUpdate failed')
  }
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
  const res = await _SetFavoriteBenchmarks(ids)
  if (res !== true) throw new Error(typeof res === 'string' ? res : 'SetFavoriteBenchmarks failed')
}

export async function getBenchmarkProgress(benchmarkId: number): Promise<BenchmarkProgress> {
  const data = await _GetBenchmarkProgress(benchmarkId)
  return data as unknown as BenchmarkProgress
}

// Launch a Kovaak's scenario via Steam deeplink
export async function launchScenario(name: string, mode: string = 'challenge'): Promise<void> {
  const res = await _LaunchKovaaksScenario(String(name || ''), String(mode || 'challenge'))
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'LaunchKovaaksScenario failed')
  }
}

// Launch a Kovaak's playlist via Steam deeplink using a sharecode
export async function launchPlaylist(sharecode: string): Promise<void> {
  const res = await _LaunchKovaaksPlaylist(String(sharecode || ''))
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'LaunchKovaaksPlaylist failed')
  }
}

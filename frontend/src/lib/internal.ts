import {
  GetBenchmarkProgress as _GetBenchmarkProgress,
  GetBenchmarks as _GetBenchmarks,
  GetFavoriteBenchmarks as _GetFavoriteBenchmarks,
  GetRecentScenarios as _GetRecentScenarios,
  GetSettings as _GetSettings,
  LaunchKovaaksScenario as _LaunchKovaaksScenario,
  ResetSettings as _ResetSettings,
  SetFavoriteBenchmarks as _SetFavoriteBenchmarks,
  StartWatcher as _StartWatcher,
  StopWatcher as _StopWatcher,
  UpdateSettings as _UpdateSettings
} from '../../wailsjs/go/main/App'
import type { models } from '../../wailsjs/go/models'
import type { Benchmark, ScenarioRecord, Settings } from '../types/ipc'

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
  // Convert generated model type to our UI type (same shape)
  return (Array.isArray(res) ? res : []) as unknown as ScenarioRecord[]
}

export async function getSettings(): Promise<Settings> {
  const s = await _GetSettings()
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

export async function getBenchmarks(): Promise<Benchmark[]> {
  const benchmarks = await _GetBenchmarks()
  if (!Array.isArray(benchmarks)) throw new Error('GetBenchmarks failed')
  // The generated type is models.Benchmark[], which is structurally compatible with our UI's Benchmark
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

export async function getBenchmarkProgress(benchmarkId: number): Promise<Record<string, any>> {
  const raw = await _GetBenchmarkProgress(benchmarkId)
  // Backend returns raw JSON string to preserve insertion order
  const data = JSON.parse(String(raw))
  if (!data || typeof data !== 'object') throw new Error('GetBenchmarkProgress failed')
  return data as Record<string, any>
}

// Launch a Kovaak's scenario via Steam deeplink
export async function launchScenario(name: string, mode: string = 'challenge'): Promise<void> {
  const res = await _LaunchKovaaksScenario(String(name || ''), String(mode || 'challenge'))
  if (res !== true) {
    throw new Error(typeof res === 'string' ? res : 'LaunchKovaaksScenario failed')
  }
}

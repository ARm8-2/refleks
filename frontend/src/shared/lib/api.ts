import {
  CheckForUpdates as _CheckForUpdates,
  ClearCache as _ClearCache,
  DeleteRunReplay as _DeleteRunReplay,
  DownloadAndInstallUpdate as _DownloadAndInstallUpdate,
  GetAllBenchmarkProgresses as _GetAllBenchmarkProgresses,
  GetBenchmarkProgress as _GetBenchmarkProgress,
  GetBenchmarks as _GetBenchmarks,
  GetDefaultSettings as _GetDefaultSettings,
  GetFavoriteBenchmarks as _GetFavoriteBenchmarks,
  GetLastScenarioScores as _GetLastScenarioScores,
  GetRecentRuns as _GetRecentRuns,
  GetRunPerformanceEvents as _GetRunPerformanceEvents,
  GetRunReplay as _GetRunReplay,
  GetRunReplayInfo as _GetRunReplayInfo,
  GetRunReplayStatus as _GetRunReplayStatus,
  GetRunStatsEvents as _GetRunStatsEvents,
  GetRunTrace as _GetRunTrace,
  GetScreenCaptureInfo as _GetScreenCaptureInfo,
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
  UpdateSettings as _UpdateSettings,
} from "@wails/go/main/App";
import type {
  Benchmark,
  BenchmarkProgress,
  KovaaksLastScore,
  ReplayFileInfo,
  ReplayStatus,
  RunPerformanceEvent,
  RunRecord,
  RunStatsEvent,
  ScreenCaptureInfo,
  Settings,
  UpdateInfo,
} from "../types/ipc";

// Typed wrappers around Wails-generated bindings with normalized results

export async function setAutostart(enabled: boolean): Promise<void> {
  await _SetAutostart(enabled);
}

export async function quitApp(): Promise<void> {
  await _QuitApp();
}

export async function startWatcher(path = ""): Promise<void> {
  await _StartWatcher(path);
}

export async function stopWatcher(): Promise<void> {
  await _StopWatcher();
}

export async function getRecentRuns(limit = 0): Promise<RunRecord[]> {
  const res = await _GetRecentRuns(limit);
  return (Array.isArray(res) ? res : []) as unknown as RunRecord[];
}

export async function getRunStatsEvents(
  filePath: string,
): Promise<RunStatsEvent[]> {
  const res = await _GetRunStatsEvents(filePath);
  return (Array.isArray(res) ? res : []) as unknown as RunStatsEvent[];
}

export async function getRunPerformanceEvents(
  filePath: string,
): Promise<RunPerformanceEvent[]> {
  const res = await _GetRunPerformanceEvents(filePath);
  return (Array.isArray(res) ? res : []) as unknown as RunPerformanceEvent[];
}

export async function getRunTrace(filePath: string): Promise<string> {
  const res = await _GetRunTrace(filePath);
  return res;
}

export async function getLastScenarioScores(
  scenarioName: string,
): Promise<KovaaksLastScore[]> {
  const res = await _GetLastScenarioScores(scenarioName);
  return (Array.isArray(res) ? res : []) as unknown as KovaaksLastScore[];
}

export async function getSettings(): Promise<Settings> {
  const res = await _GetSettings();
  return res as unknown as Settings;
}

export async function getDefaultSettings(): Promise<Settings> {
  const res = await _GetDefaultSettings();
  return res as unknown as Settings;
}

export async function updateSettings(payload: Settings): Promise<void> {
  await _UpdateSettings(
    payload as unknown as Parameters<typeof _UpdateSettings>[0],
  );
}

export async function resetSettings(
  config: boolean,
  favorites: boolean,
  scenarioNotes: boolean,
  sessionNotes: boolean,
): Promise<void> {
  await _ResetSettings(config, favorites, scenarioNotes, sessionNotes);
}

export async function saveScenarioNote(
  scenario: string,
  notes: string,
  sens: string,
): Promise<void> {
  await _SaveScenarioNote(scenario, notes, sens);
}

export async function saveSessionNote(
  sessionID: string,
  name: string,
  notes: string,
): Promise<void> {
  await _SaveSessionNote(sessionID, name, notes);
}

export async function getVersion(): Promise<string> {
  const res = await _GetVersion();
  return String(res || "");
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const res = await _CheckForUpdates();
  return res as unknown as UpdateInfo;
}

export async function downloadAndInstallUpdate(version = ""): Promise<void> {
  await _DownloadAndInstallUpdate(version);
}

export async function getBenchmarks(): Promise<Benchmark[]> {
  const res = await _GetBenchmarks();
  if (!Array.isArray(res)) throw new Error("GetBenchmarks failed");
  return res as unknown as Benchmark[];
}

export async function getFavoriteBenchmarks(): Promise<string[]> {
  const res = await _GetFavoriteBenchmarks();
  return Array.isArray(res) ? res : [];
}

export async function setFavoriteBenchmarks(ids: string[]): Promise<void> {
  await _SetFavoriteBenchmarks(ids);
}

export async function getBenchmarkProgress(
  benchmarkId: number,
): Promise<BenchmarkProgress> {
  const res = await _GetBenchmarkProgress(benchmarkId);
  return res as unknown as BenchmarkProgress;
}

export async function getAllBenchmarkProgresses(): Promise<
  Record<number, BenchmarkProgress>
> {
  const res = await _GetAllBenchmarkProgresses();
  return res as unknown as Record<number, BenchmarkProgress>;
}

export async function refreshAllBenchmarkProgresses(): Promise<
  Record<number, BenchmarkProgress>
> {
  const res = await _RefreshAllBenchmarkProgresses();
  return res as unknown as Record<number, BenchmarkProgress>;
}

// Launch a Kovaak's scenario via Steam deeplink
export async function launchScenario(
  name: string,
  mode: string = "challenge",
): Promise<void> {
  await _LaunchKovaaksScenario(String(name || ""), String(mode || "challenge"));
}

// Launch a Kovaak's playlist via Steam deeplink using a sharecode
export async function launchPlaylist(sharecode: string): Promise<void> {
  await _LaunchKovaaksPlaylist(String(sharecode || ""));
}

export async function clearCache(): Promise<void> {
  await _ClearCache();
}

export async function getRunReplay(filePath: string): Promise<string | null> {
  const res = await _GetRunReplay(filePath);
  return res || null;
}

export async function getRunReplayInfo(
  filePath: string,
): Promise<ReplayFileInfo | null> {
  return (await _GetRunReplayInfo(filePath)) || null;
}

export async function getRunReplayStatus(
  filePath: string,
): Promise<ReplayStatus> {
  const res = await _GetRunReplayStatus(filePath);
  return res as unknown as ReplayStatus;
}

export async function deleteRunReplay(filePath: string): Promise<void> {
  await _DeleteRunReplay(filePath);
}

export async function getScreenCaptureInfo(): Promise<ScreenCaptureInfo> {
  return (await _GetScreenCaptureInfo()) as unknown as ScreenCaptureInfo;
}

// Runtime helpers
export { BrowserOpenURL as openURL } from "@wails/runtime";

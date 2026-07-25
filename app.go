package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"refleks/internal/autostart"
	"refleks/internal/benchmarks"
	"refleks/internal/cache"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/process"
	"refleks/internal/runs"
	"refleks/internal/runs/screen"
	"refleks/internal/scenarios"
	appsettings "refleks/internal/settings"
	"refleks/internal/updater"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx            context.Context
	runsRuntimeSvc *runs.RuntimeService
	settingsSvc    *appsettings.Service
	benchmarkSvc   *benchmarks.Service
	scenarioSvc    *scenarios.Service
	updaterSvc     *updater.Service
	cacheSvc       *cache.Service
	runStore       *runs.Store
	autostartSvc   *autostart.Service
	processWatcher *process.Watcher
	watcherCancel  context.CancelFunc
	isQuitting     bool
}

// NewApp creates a new App application struct
func NewApp() *App { return &App{} }

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.LogInfo(a.ctx, "RefleK's app starting up")
	if err := screen.CleanupAbandonedSessions(); err != nil {
		runtime.LogWarningf(a.ctx, "screen: clean abandoned capture sessions: %v", err)
	}

	// Initialize Settings Service
	a.settingsSvc = appsettings.NewService()
	if err := a.settingsSvc.Load(); err != nil {
		runtime.LogWarning(a.ctx, "settings load failed, using defaults: "+err.Error())
		// Load failed, but NewService already set defaults. Try to save them.
		_ = a.settingsSvc.Update(a.settingsSvc.Get())
	}
	settings := a.settingsSvc.Get()

	// Initialize Core Services
	a.cacheSvc = cache.NewService()
	a.runStore = runs.NewStore(a.settingsSvc)
	a.updaterSvc = updater.NewService(constants.GitHubOwner, constants.GitHubRepo, constants.AppVersion)

	// Initialize Domain Services
	a.benchmarkSvc = benchmarks.NewService(a.settingsSvc, a.cacheSvc)
	a.scenarioSvc = scenarios.NewService(a.settingsSvc)
	a.benchmarkSvc.SetOnBenchmarksUpdated(func(items []models.Benchmark) {
		runtime.EventsEmit(a.ctx, constants.EventBenchmarkCatalogUpdated, map[string]any{"count": len(items)})
	})

	// Initialize runs runtime service (coordinates Watcher + Mouse)
	a.runsRuntimeSvc = runs.NewRuntimeService(a.ctx, a.settingsSvc, a.benchmarkSvc, a.runStore)

	// Initialize Autostart Service
	a.autostartSvc = autostart.NewService()

	// Initialize Process Watcher if enabled
	if settings.AutostartEnabled {
		a.startProcessWatcher()
	}

	// Auto-start watcher. RuntimeService logs a start failure at its owner
	// boundary before returning it, so avoid emitting the same error twice.
	_ = a.runsRuntimeSvc.StartWatcher()

	// Fire-and-forget benchmark definitions + progress cache warmup/sync
	go func() {
		if err := a.benchmarkSvc.SyncBenchmarksCache(); err != nil {
			runtime.LogErrorf(a.ctx, "benchmark definitions sync failed: %v", err)
		}
		_, err := a.benchmarkSvc.GetAllBenchmarkProgresses()
		if err != nil {
			runtime.LogErrorf(a.ctx, "benchmark cache sync failed: %v", err)
		}
	}()

	// Fire-and-forget check for app updates
	go func() {
		time.Sleep(2 * time.Second)
		info, err := a.CheckForUpdates()
		if err != nil {
			runtime.LogDebugf(a.ctx, "update check: %v", err)
			return
		}
		if info.HasUpdate {
			runtime.LogInfof(a.ctx, "update available: %s -> %s", info.CurrentVersion, info.LatestVersion)
			runtime.EventsEmit(a.ctx, constants.EventUpdateAvailable, info)
		}
	}()
}

// StartWatcher begins monitoring the configured Kovaak's install directory.
// The optional installDir overrides the currently configured directory; pass
// an empty string to keep the existing setting.
func (a *App) StartWatcher(installDir string) error {
	return a.runsRuntimeSvc.StartWatcherAt(installDir)
}

// StopWatcher stops the watcher if running.
func (a *App) StopWatcher() error {
	return a.runsRuntimeSvc.StopWatcher()
}

// GetRecentRuns returns most recent parsed runs, up to optional limit.
func (a *App) GetRecentRuns(limit int) []models.RunRecord {
	return a.runsRuntimeSvc.GetRecent(limit)
}

// GetRunStatsEvents returns the CSV-derived event rows nested under stats.events.
// They are loaded on demand instead of being included in the bulk recent-runs payload.
func (a *App) GetRunStatsEvents(filePath string) ([]models.RunStatsEvent, error) {
	return a.runStore.LoadRunStatsEvents(filePath)
}

// GetRunPerformanceEvents returns the event list stored in the v2 performances payload.
// They are loaded on demand instead of being included in the bulk recent-runs payload.
func (a *App) GetRunPerformanceEvents(filePath string) ([]models.RunPerformanceEvent, error) {
	return a.runStore.LoadRunPerformanceEvents(filePath)
}

// GetRunTrace retrieves the binary trace data for a run, encoded as Base64.
// This is called lazily by the frontend when the user views the trace tab.
func (a *App) GetRunTrace(filePath string) (string, error) {
	return a.runStore.LoadRunTrace(filePath)
}

// resolveReplayPath finds the on-disk replay file for a run, trying both
// container extensions a recording may have been saved with. Returns the
// absolute disk path and the URL path served by the embedded
// replayAssetHandler at /replays/..., or ok=false if no recording exists.
func (a *App) resolveReplayPath(filePath string) (diskPath, urlPath string, ok bool) {
	base := strings.TrimSuffix(filepath.Base(filePath), constants.RunFileExt)
	for _, ext := range []string{".mp4", ".webm"} {
		path, err := a.runStore.ReplayPath(filePath, ext)
		if err != nil {
			continue
		}
		if info, err := os.Stat(path); err == nil {
			// A content version lets the browser cache ranges for smooth seeking
			// without serving a stale file after an export replaces this replay.
			version := fmt.Sprintf("%x-%x", info.ModTime().UnixNano(), info.Size())
			return path, "/replays/" + url.PathEscape(base+ext) + "?v=" + version, true
		}
	}
	return "", "", false
}

// GetRunReplay returns the URL path to the screen recording replay for a run,
// or an empty string if no recording exists. The URL is served by the
// embedded replayAssetHandler at /replays/...
func (a *App) GetRunReplay(filePath string) string {
	_, urlPath, ok := a.resolveReplayPath(filePath)
	if !ok {
		return ""
	}
	return urlPath
}

// GetRunReplayInfo returns technical metadata (resolution, frame rate, codec,
// duration, file size) about a run's saved replay, probed directly from the
// file, or nil if no recording exists.
func (a *App) GetRunReplayInfo(filePath string) (*screen.ReplayFileInfo, error) {
	diskPath, _, ok := a.resolveReplayPath(filePath)
	if !ok {
		return nil, nil
	}
	enc := a.runsRuntimeSvc.Encoder()
	if enc == nil {
		return nil, fmt.Errorf("encoder not available")
	}
	info, err := enc.ProbeReplay(diskPath)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

// DeleteRunReplay deletes a run's saved screen recording replay, if any.
// No-op (not an error) if no recording exists.
func (a *App) DeleteRunReplay(filePath string) error {
	if a.runStore == nil {
		return nil
	}
	return a.runStore.DeleteReplay(filePath)
}

// GetScreenCaptureInfo returns info about the configured screen capture encoder,
// or nil if screen capture is not available.
func (a *App) GetScreenCaptureInfo() *screen.EncoderInfo {
	enc := a.runsRuntimeSvc.Encoder()
	if enc == nil || !enc.Available() {
		return nil
	}
	info := enc.Info()
	return &info
}

// GetLastScenarioScores fetches the last 10 scores for a given scenario from KovaaK's API.
func (a *App) GetLastScenarioScores(scenarioName string) ([]models.KovaaksLastScore, error) {
	return a.scenarioSvc.GetLastScores(scenarioName)
}

// GetBenchmarks returns the cached benchmark list for the Explore UI.
func (a *App) GetBenchmarks() ([]models.Benchmark, error) {
	return a.benchmarkSvc.GetBenchmarks()
}

// GetBenchmarkProgress returns a structured benchmark progress model for the given benchmarkId.
func (a *App) GetBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, error) {
	// 1. Try to get from cache (or fetch if missing)
	data, cached, err := a.benchmarkSvc.GetBenchmarkProgress(benchmarkId, true)
	if err != nil {
		return models.BenchmarkProgress{}, err
	}

	// 2. Trigger background refresh (if it was cached)
	if cached {
		go func() {
			fresh, _, err := a.benchmarkSvc.GetBenchmarkProgress(benchmarkId, false)
			if err == nil {
				// Emit event with fresh data so frontend can update
				runtime.EventsEmit(a.ctx, fmt.Sprintf("%s%d", constants.EventBenchmarkProgressPrefix, benchmarkId), fresh)
			}
		}()
	}

	return data, nil
}

// GetAllBenchmarkProgresses returns progress for all benchmarks, using cache if available.
func (a *App) GetAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	return a.benchmarkSvc.GetAllBenchmarkProgresses()
}

// RefreshAllBenchmarkProgresses fetches fresh data for all benchmarks and updates the cache.
func (a *App) RefreshAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	return a.benchmarkSvc.RefreshAllBenchmarkProgresses()
}

// --- Settings IPC ---

// GetSettings returns the current settings.
func (a *App) GetSettings() models.Settings {
	return a.settingsSvc.Get()
}

// UpdateSettings updates settings and persists them; applies to watcher if needed.
func (a *App) UpdateSettings(s models.Settings) error {
	return a.runsRuntimeSvc.UpdateSettings(s)
}

// Favorites helpers
func (a *App) GetFavoriteBenchmarks() []string {
	return a.settingsSvc.GetFavoriteBenchmarks()
}

func (a *App) SetFavoriteBenchmarks(ids []string) error {
	return a.settingsSvc.SetFavoriteBenchmarks(ids)
}

// ResetSettings resets settings to application defaults and applies them immediately.
func (a *App) ResetSettings(resetConfig, resetFavorites, resetScenarioNotes, resetSessionNotes bool) error {
	newSettings := a.settingsSvc.Get()

	if resetConfig {
		defaults := appsettings.Default()
		newSettings.SteamInstallDir = defaults.SteamInstallDir
		newSettings.KovaaksInstallDir = defaults.KovaaksInstallDir
		newSettings.SessionGapMinutes = defaults.SessionGapMinutes
		newSettings.RecentRunsDays = defaults.RecentRunsDays
		newSettings.RecentRunsMinCount = defaults.RecentRunsMinCount
		newSettings.Theme = defaults.Theme
		newSettings.Font = defaults.Font
		newSettings.MouseTrackingEnabled = defaults.MouseTrackingEnabled
		newSettings.MouseBufferMinutes = defaults.MouseBufferMinutes
		newSettings.ScreenCaptureEnabled = defaults.ScreenCaptureEnabled
		newSettings.ScreenCaptureFPS = defaults.ScreenCaptureFPS
		newSettings.ScreenCaptureResolution = defaults.ScreenCaptureResolution
		newSettings.AutostartEnabled = defaults.AutostartEnabled
		newSettings.AnonymousEnabled = defaults.AnonymousEnabled
		newSettings.RunSyncEnabled = defaults.RunSyncEnabled
		newSettings.LastSeenVersion = defaults.LastSeenVersion

		// Sync autostart state
		if newSettings.AutostartEnabled {
			_ = a.autostartSvc.Enable("--monitor")
			a.startProcessWatcher()
		} else {
			_ = a.autostartSvc.Disable()
			a.stopProcessWatcher()
		}
	}

	if resetFavorites {
		newSettings.FavoriteBenchmarks = nil
	}

	if resetScenarioNotes {
		newSettings.ScenarioNotes = nil
	}

	if resetSessionNotes {
		newSettings.SessionNotes = nil
	}

	return a.runsRuntimeSvc.OverwriteSettings(newSettings)
}

// --- App metadata ---

// GetVersion returns the current application version.
func (a *App) GetVersion() string {
	return constants.AppVersion
}

// GetDefaultSettings returns the application's default settings (sanitized).
func (a *App) GetDefaultSettings() models.Settings {
	return appsettings.Sanitize(appsettings.Default())
}

// LaunchKovaaksScenario opens the Steam deep-link to launch a given scenario in Kovaak's.
func (a *App) LaunchKovaaksScenario(name string, mode string) error {
	n := url.PathEscape(name)
	if n == "" {
		return fmt.Errorf("missing scenario name")
	}
	if mode == "" {
		mode = "challenge"
	}
	m := url.PathEscape(mode)
	deeplink := fmt.Sprintf("steam://run/%d/?action=jump-to-scenario;name=%s;mode=%s", constants.KovaaksSteamAppID, n, m)
	process.OpenURL(deeplink)
	return nil
}

// LaunchKovaaksPlaylist opens a Steam deep-link that jumps directly to a shared playlist by sharecode.
func (a *App) LaunchKovaaksPlaylist(sharecode string) error {
	sc := url.PathEscape(sharecode)
	if sc == "" {
		return fmt.Errorf("missing sharecode")
	}
	deeplink := fmt.Sprintf("steam://run/%d/?action=jump-to-playlist;sharecode=%s", constants.KovaaksSteamAppID, sc)
	process.OpenURL(deeplink)
	return nil
}

// --- Updater IPC ---

// CheckForUpdates queries GitHub releases and returns update availability and download URL.
func (a *App) CheckForUpdates() (models.UpdateInfo, error) {
	return a.updaterSvc.CheckForUpdates(a.ctx)
}

// DownloadAndInstallUpdate downloads the specified (or latest) installer and starts it, then quits the app.
func (a *App) DownloadAndInstallUpdate(version string) error {
	if err := a.updaterSvc.DownloadAndInstallUpdate(a.ctx, version); err != nil {
		return err
	}
	// Gracefully quit current app so installer can proceed
	go func() {
		time.Sleep(1 * time.Second)
		runtime.Quit(a.ctx)
	}()
	return nil
}

// SaveScenarioNote persists a user note and sensitivity for a scenario.
func (a *App) SaveScenarioNote(scenario, notes, sens string) error {
	return a.runsRuntimeSvc.SaveScenarioNote(scenario, notes, sens)
}

// SaveSessionNote persists a user name and notes for a session.
func (a *App) SaveSessionNote(sessionID, name, notes string) error {
	return a.runsRuntimeSvc.SaveSessionNote(sessionID, name, notes)
}

// ClearCache clears the application cache.
func (a *App) ClearCache() error {
	// This triggers callbacks registered via cache.RegisterOnClear
	if err := a.cacheSvc.ClearAll(); err != nil {
		return err
	}
	return nil
}

// --- Autostart & Monitoring ---

func (a *App) SetAutostart(enabled bool) error {
	settings := a.settingsSvc.Get()
	settings.AutostartEnabled = enabled
	if err := a.settingsSvc.Update(settings); err != nil {
		return err
	}

	if enabled {
		if err := a.autostartSvc.Enable("--monitor"); err != nil {
			return fmt.Errorf("failed to enable autostart: %w", err)
		}
		a.startProcessWatcher()
	} else {
		if err := a.autostartSvc.Disable(); err != nil {
			return fmt.Errorf("failed to disable autostart: %w", err)
		}
		a.stopProcessWatcher()
	}
	return nil
}

func (a *App) startProcessWatcher() {
	if a.watcherCancel != nil {
		return // Already running
	}
	ctx, cancel := context.WithCancel(a.ctx)
	a.watcherCancel = cancel

	a.processWatcher = process.NewWatcher(constants.KovaaksProcessName, func() {
		runtime.WindowShow(a.ctx)
		if runtime.Environment(a.ctx).Platform == "windows" {
			// Briefly set always on top to grab focus, then disable
			runtime.WindowSetAlwaysOnTop(a.ctx, true)
			go func() {
				time.Sleep(500 * time.Millisecond)
				runtime.WindowSetAlwaysOnTop(a.ctx, false)
			}()
		}
	}, nil)
	go a.processWatcher.Start(ctx)
}

func (a *App) stopProcessWatcher() {
	if a.watcherCancel != nil {
		a.watcherCancel()
		a.watcherCancel = nil
		a.processWatcher = nil
	}
}

// QuitApp sets the quitting flag and exits.
func (a *App) QuitApp() {
	a.isQuitting = true
	runtime.Quit(a.ctx)
}

// ShowWindow brings the window to front.
func (a *App) ShowWindow() {
	runtime.WindowShow(a.ctx)
}

func (a *App) shouldRunInBackground() bool {
	if a.isQuitting {
		return false
	}
	return a.settingsSvc.Get().AutostartEnabled
}

func (a *App) hideWindow() {
	runtime.WindowHide(a.ctx)
}

// shutdown runs once on a real process exit (see OnShutdown in main.go).
// It stops capture and performs best-effort cleanup of temporary segments;
// startup cleanup removes any files that were locked or left by a forced exit.
func (a *App) shutdown(ctx context.Context) {
	if a.runsRuntimeSvc != nil {
		a.runsRuntimeSvc.Shutdown()
	}
}

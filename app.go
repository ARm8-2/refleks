package main

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	appsvc "refleks/internal/appsvc"
	"refleks/internal/benchmarks"
	"refleks/internal/constants"
	"refleks/internal/models"
	appsettings "refleks/internal/settings"
	"refleks/internal/traces"
)

// App struct
type App struct {
	ctx      context.Context
	appSvc   *appsvc.AppService
	settings models.Settings
}

// NewApp creates a new App application struct
func NewApp() *App { return &App{} }

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.LogInfo(a.ctx, "RefleK's app starting up")
	// Load settings from disk
	if s, err := appsettings.Load(); err == nil {
		a.settings = s
	} else {
		runtime.LogWarning(a.ctx, "settings load failed, using defaults: "+err.Error())
		a.settings = appsettings.Default()
		_ = appsettings.Save(a.settings)
	}
	// Ensure sane defaults for new fields
	a.settings = appsettings.Sanitize(a.settings)

	// Configure traces storage directory (supports placeholders)
	tracesDir := appsettings.ExpandPathPlaceholders(a.settings.TracesDir)
	traces.SetBaseDir(tracesDir)

	// Initialize coordinated AppService (wires mouse, watcher, updater)
	a.appSvc = appsvc.NewAppService(a.ctx, &a.settings)

	// Fire-and-forget check for app updates; emit event if available
	go func() {
		// Small delay to avoid competing with startup I/O
		time.Sleep(2 * time.Second)
		info, err := a.CheckForUpdates()
		if err != nil {
			runtime.LogDebugf(a.ctx, "update check: %v", err)
			return
		}
		if info.HasUpdate {
			runtime.LogInfof(a.ctx, "update available: %s -> %s", info.CurrentVersion, info.LatestVersion)
			runtime.EventsEmit(a.ctx, "UpdateAvailable", info)
		}
	}()
}

// StartWatcher begins monitoring the given directory for new Kovaak's CSV files.
func (a *App) StartWatcher(path string) (bool, string) {
	if a.appSvc == nil {
		a.appSvc = appsvc.NewAppService(a.ctx, &a.settings)
	}
	return a.appSvc.StartWatcher(path)
}

// StopWatcher stops the watcher if running.
func (a *App) StopWatcher() (bool, string) {
	if a.appSvc == nil {
		return true, "not running"
	}
	return a.appSvc.StopWatcher()
}

// GetRecentScenarios returns most recent parsed scenarios, up to optional limit.
func (a *App) GetRecentScenarios(limit int) []models.ScenarioRecord {
	if a.appSvc == nil {
		return nil
	}
	return a.appSvc.GetRecent(limit)
}

// GetBenchmarks returns the embedded benchmarks list for the Explore UI.
func (a *App) GetBenchmarks() ([]models.Benchmark, error) {
	return benchmarks.GetBenchmarks()
}

// GetBenchmarkProgress returns a structured benchmark progress model for the given benchmarkId.
// The server merges upstream player progress with local benchmark metadata (categories/ranks),
// producing a stable, UI-friendly shape.
func (a *App) GetBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, error) {
	data, err := benchmarks.GetBenchmarkProgress(benchmarkId)
	if err != nil {
		return models.BenchmarkProgress{}, err
	}
	return data, nil
}

// --- Settings IPC ---

// GetSettings returns the current settings.
func (a *App) GetSettings() models.Settings {
	return a.settings
}

// UpdateSettings updates settings and persists them; applies to watcher if needed.
func (a *App) UpdateSettings(s models.Settings) (bool, string) {
	if a.appSvc == nil {
		a.appSvc = appsvc.NewAppService(a.ctx, &a.settings)
	}
	return a.appSvc.UpdateSettings(s)
}

// Favorites helpers (retained API expected by the frontend)
func (a *App) GetFavoriteBenchmarks() []string {
	return appsettings.GetFavoriteBenchmarks(a.settings)
}

func (a *App) SetFavoriteBenchmarks(ids []string) (bool, string) {
	if err := appsettings.SetFavoriteBenchmarks(&a.settings, ids); err != nil {
		return false, err.Error()
	}
	return true, "ok"
}

// ResetSettings resets settings to application defaults and applies them immediately.
func (a *App) ResetSettings() (bool, string) {
	// Delegate to UpdateSettings to reuse application logic (save, mouse, watcher, traces)
	return a.UpdateSettings(appsettings.Default())
}

// --- App metadata ---

// GetVersion returns the current application version.
func (a *App) GetVersion() string {
	return constants.AppVersion
}

// GetDefaultSettings returns the application's default settings (sanitized),
// useful for UI placeholders and help text.
func (a *App) GetDefaultSettings() models.Settings {
	return appsettings.Sanitize(appsettings.Default())
}

// LaunchKovaaksScenario opens the Steam deep-link to launch a given scenario in Kovaak's.
// The "mode" parameter is optional; default is "challenge". Returns (true, "ok") on success.
func (a *App) LaunchKovaaksScenario(name string, mode string) (bool, string) {
	n := url.PathEscape(name)
	if n == "" {
		return false, "missing scenario name"
	}
	if mode == "" {
		mode = "challenge"
	}
	m := url.PathEscape(mode)
	deeplink := fmt.Sprintf("steam://run/%d/?action=jump-to-scenario;name=%s;mode=%s", constants.KovaaksSteamAppID, n, m)
	runtime.BrowserOpenURL(a.ctx, deeplink)
	return true, "ok"
}

// LaunchKovaaksPlaylist opens a Steam deep-link that jumps directly to a shared playlist by sharecode.
// Returns (true, "ok") on success or (false, reason) on failure.
func (a *App) LaunchKovaaksPlaylist(sharecode string) (bool, string) {
	sc := url.PathEscape(sharecode)
	if sc == "" {
		return false, "missing sharecode"
	}
	deeplink := fmt.Sprintf("steam://run/%d/?action=jump-to-playlist;sharecode=%s", constants.KovaaksSteamAppID, sc)
	runtime.BrowserOpenURL(a.ctx, deeplink)
	return true, "ok"
}

// --- Updater IPC ---

// CheckForUpdates queries GitHub releases and returns update availability and download URL.
func (a *App) CheckForUpdates() (models.UpdateInfo, error) {
	if a.appSvc == nil {
		a.appSvc = appsvc.NewAppService(a.ctx, &a.settings)
	}
	return a.appSvc.CheckForUpdates(a.ctx)
}

// DownloadAndInstallUpdate downloads the specified (or latest) installer and starts it, then quits the app.
// version may be empty to auto-detect latest.
func (a *App) DownloadAndInstallUpdate(version string) (bool, string) {
	if a.appSvc == nil {
		a.appSvc = appsvc.NewAppService(a.ctx, &a.settings)
	}
	if err := a.appSvc.DownloadAndInstallUpdate(a.ctx, version); err != nil {
		return false, err.Error()
	}
	// Gracefully quit current app so installer can proceed
	go func() {
		time.Sleep(1 * time.Second)
		runtime.Quit(a.ctx)
	}()
	return true, "ok"
}

package main

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/benchmarks"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/mouse"
	appsettings "refleks/internal/settings"
	"refleks/internal/traces"
	"refleks/internal/updater"
	"refleks/internal/watcher"
)

// App struct
type App struct {
	ctx      context.Context
	watcher  *watcher.Watcher
	settings models.Settings
	mouse    mouse.Provider
}

// NewApp creates a new App application struct
func NewApp() *App { return &App{} }

// makeWatcherConfig centralizes construction of the WatcherConfig.
func (a *App) makeWatcherConfig(path string) models.WatcherConfig {
	return models.WatcherConfig{
		Path:                 path,
		SessionGap:           time.Duration(a.settings.SessionGapMinutes) * time.Minute,
		PollInterval:         time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		ParseExistingOnStart: true,
		ParseExistingLimit:   a.settings.MaxExistingOnStart,
	}
}

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

	// Init mouse provider (platform-specific; no-op on non-Windows)
	a.mouse = mouse.New(constants.DefaultMouseSampleHz)
	a.mouse.SetBufferDuration(time.Duration(a.settings.MouseBufferMinutes) * time.Minute)
	if a.settings.MouseTrackingEnabled {
		if err := a.mouse.Start(); err != nil {
			runtime.LogWarningf(a.ctx, "mouse tracker start failed: %v", err)
		} else {
			runtime.LogInfo(a.ctx, "mouse tracker started")
		}
	}

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
	if path == "" {
		// default to settings
		if a.settings.StatsDir != "" {
			path = a.settings.StatsDir
		} else {
			path = appsettings.DefaultStatsDir()
		}
	} else {
		// update settings if provided by UI
		a.settings.StatsDir = path
		_ = appsettings.Save(a.settings)
	}
	cfg := a.makeWatcherConfig(path)
	if a.watcher == nil {
		a.watcher = watcher.New(a.ctx, cfg)
		// inject mouse provider for enrichment
		if a.mouse != nil {
			a.watcher.SetMouseProvider(a.mouse)
		}
	} else {
		if err := a.watcher.UpdateConfig(cfg); err != nil {
			return false, err.Error()
		}
		// Clear previous in-memory scenarios to avoid duplicates on restart
		a.watcher.Clear()
	}
	if err := a.watcher.Start(); err != nil {
		runtime.LogErrorf(a.ctx, "Watcher start error: %v", err)
		return false, err.Error()
	}
	return true, "ok"
}

// StopWatcher stops the watcher if running.
func (a *App) StopWatcher() (bool, string) {
	if a.watcher == nil {
		return true, "not running"
	}
	if err := a.watcher.Stop(); err != nil {
		return false, err.Error()
	}
	return true, "stopped"
}

// GetRecentScenarios returns most recent parsed scenarios, up to optional limit.
func (a *App) GetRecentScenarios(limit int) []models.ScenarioRecord {
	if a.watcher == nil {
		return nil
	}
	return a.watcher.GetRecent(limit)
}

// GetBenchmarks returns the embedded benchmarks list for the Explore UI.
func (a *App) GetBenchmarks() ([]models.Benchmark, error) {
	return benchmarks.GetBenchmarks()
}

// GetBenchmarkProgress fetches live player progress for a given difficulty benchmarkId.
// Returns raw JSON string to preserve original key order from upstream.
func (a *App) GetBenchmarkProgress(benchmarkId int) (string, error) {
	data, err := benchmarks.GetPlayerProgressRaw(benchmarkId)
	if err != nil {
		return "", err
	}
	return data, nil
}

// Greet retained for scaffolding sanity test
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// --- Settings IPC ---

// GetSettings returns the current settings.
func (a *App) GetSettings() models.Settings {
	return a.settings
}

// UpdateSettings updates settings and persists them; applies to watcher if needed.
func (a *App) UpdateSettings(s models.Settings) (bool, string) {
	s = appsettings.Sanitize(s)
	prevTraces := a.settings.TracesDir
	// Carry over existing list if omitted
	if len(s.FavoriteBenchmarks) == 0 && len(a.settings.FavoriteBenchmarks) > 0 {
		s.FavoriteBenchmarks = a.settings.FavoriteBenchmarks
	}
	a.settings = s
	if err := appsettings.Save(a.settings); err != nil {
		return false, err.Error()
	}
	// Apply to mouse provider
	if a.mouse == nil {
		a.mouse = mouse.New(constants.DefaultMouseSampleHz)
	}
	a.mouse.SetBufferDuration(time.Duration(a.settings.MouseBufferMinutes) * time.Minute)
	if a.settings.MouseTrackingEnabled {
		if !a.mouse.Enabled() {
			if err := a.mouse.Start(); err != nil {
				runtime.LogWarningf(a.ctx, "mouse tracker start failed: %v", err)
			}
		}
	} else {
		if a.mouse.Enabled() {
			a.mouse.Stop()
		}
	}
	// Ensure watcher reflects latest settings. If running, restart with new config; if stopped, just update config.
	if a.watcher != nil {
		cfg := a.makeWatcherConfig(a.settings.StatsDir)
		if a.watcher.IsRunning() {
			// Stop, reconfigure, restart
			_ = a.watcher.Stop()
			if err := a.watcher.UpdateConfig(cfg); err != nil {
				return false, err.Error()
			}
			// Clear old state so parse-existing repopulates from scratch
			a.watcher.Clear()
			if a.mouse != nil {
				a.watcher.SetMouseProvider(a.mouse)
			}
			if err := a.watcher.Start(); err != nil {
				runtime.LogErrorf(a.ctx, "Watcher restart error: %v", err)
				return false, err.Error()
			}
		} else {
			// Not running: just update cfg so the next start uses it
			if err := a.watcher.UpdateConfig(cfg); err != nil {
				return false, err.Error()
			}
			// Clear pending state to ensure a clean start
			a.watcher.Clear()
			if a.mouse != nil {
				a.watcher.SetMouseProvider(a.mouse)
			}
		}
	}
	// Apply traces directory override for persistence and reload if changed
	tracesDir := appsettings.ExpandPathPlaceholders(a.settings.TracesDir)
	traces.SetBaseDir(tracesDir)
	if a.watcher != nil && appsettings.ExpandPathPlaceholders(prevTraces) != tracesDir {
		n := a.watcher.ReloadTraces()
		runtime.LogInfof(a.ctx, "reloaded traces for %d scenarios after tracesDir change", n)
	}
	return true, "ok"
}

// Favorites helpers (retained API expected by the frontend)
func (a *App) GetFavoriteBenchmarks() []string {
	return append([]string(nil), a.settings.FavoriteBenchmarks...)
}

func (a *App) SetFavoriteBenchmarks(ids []string) (bool, string) {
	a.settings.FavoriteBenchmarks = append([]string(nil), ids...)
	if err := appsettings.Save(a.settings); err != nil {
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
	u := updater.New(constants.GitHubOwner, constants.GitHubRepo, constants.AppVersion)
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	latest, notes, err := u.Latest(ctx)
	if err != nil {
		return models.UpdateInfo{CurrentVersion: constants.AppVersion}, err
	}
	has := updater.CompareSemver(constants.AppVersion, latest) < 0
	info := models.UpdateInfo{
		CurrentVersion: constants.AppVersion,
		LatestVersion:  latest,
		HasUpdate:      has,
		ReleaseNotes:   notes,
	}
	if has {
		if url, err := u.BuildDownloadURL(latest); err == nil {
			info.DownloadURL = url
		}
	}
	return info, nil
}

// DownloadAndInstallUpdate downloads the specified (or latest) installer and starts it, then quits the app.
// version may be empty to auto-detect latest.
func (a *App) DownloadAndInstallUpdate(version string) (bool, string) {
	u := updater.New(constants.GitHubOwner, constants.GitHubRepo, constants.AppVersion)
	if version == "" {
		ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
		defer cancel()
		latest, _, err := u.Latest(ctx)
		if err != nil {
			return false, err.Error()
		}
		version = latest
	}
	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Minute)
	defer cancel()
	path, err := u.Download(ctx, version)
	if err != nil {
		return false, err.Error()
	}
	if err := u.LaunchInstaller(ctx, path); err != nil {
		return false, err.Error()
	}
	// Gracefully quit current app so installer can proceed
	go func() {
		time.Sleep(1 * time.Second)
		runtime.Quit(a.ctx)
	}()
	return true, "ok"
}

package main

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/ai"
	"refleks/internal/autostart"
	"refleks/internal/benchmarks"
	"refleks/internal/cache"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/process"
	"refleks/internal/scenarios"
	appsettings "refleks/internal/settings"
	"refleks/internal/traces"
	"refleks/internal/tracking"
	"refleks/internal/updater"
)

// App struct
type App struct {
	ctx            context.Context
	trackingSvc    *tracking.Service
	aiSvc          *ai.Service
	settingsSvc    *appsettings.Service
	benchmarkSvc   *benchmarks.Service
	scenarioSvc    *scenarios.Service
	updaterSvc     *updater.Service
	cacheSvc       *cache.Service
	tracesSvc      *traces.Service
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
	a.tracesSvc = traces.NewService()
	a.updaterSvc = updater.NewService(constants.GitHubOwner, constants.GitHubRepo, constants.AppVersion)

	// Configure traces storage directory
	tracesDir := appsettings.ExpandPathPlaceholders(settings.TracesDir)
	a.tracesSvc.SetBaseDir(tracesDir)

	// Initialize Domain Services
	a.benchmarkSvc = benchmarks.NewService(a.settingsSvc, a.cacheSvc)
	a.scenarioSvc = scenarios.NewService(a.settingsSvc)

	// Initialize Tracking Service (coordinates Watcher + Mouse)
	a.trackingSvc = tracking.NewService(a.ctx, a.settingsSvc, a.benchmarkSvc, a.tracesSvc)

	// Initialize AI Service
	a.aiSvc = ai.NewService(a.ctx, a.settingsSvc)

	// Initialize Autostart Service
	a.autostartSvc = autostart.NewService()

	// Initialize Process Watcher if enabled
	if settings.AutostartEnabled {
		a.startProcessWatcher()
	}

	// Auto-start watcher
	if err := a.trackingSvc.StartWatcher(""); err != nil {
		runtime.LogWarningf(a.ctx, "Auto-start watcher failed: %v", err)
	}

	// Fire-and-forget benchmark cache warmup/sync
	go func() {
		time.Sleep(1 * time.Second)
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

// StartWatcher begins monitoring the given directory for new Kovaak's CSV files.
func (a *App) StartWatcher(path string) error {
	return a.trackingSvc.StartWatcher(path)
}

// StopWatcher stops the watcher if running.
func (a *App) StopWatcher() error {
	return a.trackingSvc.StopWatcher()
}

// GetRecentScenarios returns most recent parsed scenarios, up to optional limit.
func (a *App) GetRecentScenarios(limit int) []models.ScenarioRecord {
	return a.trackingSvc.GetRecent(limit)
}

// GetLastScenarioScores fetches the last 10 scores for a given scenario from KovaaK's API.
func (a *App) GetLastScenarioScores(scenarioName string) ([]models.KovaaksLastScore, error) {
	return a.scenarioSvc.GetLastScores(scenarioName)
}

// GetBenchmarks returns the embedded benchmarks list for the Explore UI.
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
	return a.trackingSvc.UpdateSettings(s)
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
		newSettings.StatsDir = defaults.StatsDir
		newSettings.TracesDir = defaults.TracesDir
		newSettings.SessionGapMinutes = defaults.SessionGapMinutes
		newSettings.Theme = defaults.Theme
		newSettings.Font = defaults.Font
		newSettings.MouseTrackingEnabled = defaults.MouseTrackingEnabled
		newSettings.MouseBufferMinutes = defaults.MouseBufferMinutes
		newSettings.MaxExistingOnStart = defaults.MaxExistingOnStart
		newSettings.GeminiAPIKey = defaults.GeminiAPIKey
		newSettings.AutostartEnabled = defaults.AutostartEnabled

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

	return a.trackingSvc.OverwriteSettings(newSettings)
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
	runtime.BrowserOpenURL(a.ctx, deeplink)
	return nil
}

// LaunchKovaaksPlaylist opens a Steam deep-link that jumps directly to a shared playlist by sharecode.
func (a *App) LaunchKovaaksPlaylist(sharecode string) error {
	sc := url.PathEscape(sharecode)
	if sc == "" {
		return fmt.Errorf("missing sharecode")
	}
	deeplink := fmt.Sprintf("steam://run/%d/?action=jump-to-playlist;sharecode=%s", constants.KovaaksSteamAppID, sc)
	runtime.BrowserOpenURL(a.ctx, deeplink)
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

// --- AI Insights (Sessions) ---

// GenerateSessionInsights starts a streaming AI analysis for the provided session records.
func (a *App) GenerateSessionInsights(sessionId string, records []models.ScenarioRecord, prompt string, options models.AIOptions) (string, error) {
	if sessionId == "" {
		sessionId = "session"
	}
	reqID := a.aiSvc.NewRequestID()
	// Pass options directly (models.AIOptions) into the AI service.
	a.aiSvc.GenerateSessionInsights(reqID, sessionId, records, prompt, options)
	return reqID, nil
}

// CancelSessionInsights cancels a running AI stream by requestId.
func (a *App) CancelSessionInsights(requestId string) error {
	a.aiSvc.Cancel(requestId)
	return nil
}

// SaveScenarioNote persists a user note and sensitivity for a scenario.
func (a *App) SaveScenarioNote(scenario, notes, sens string) error {
	return a.trackingSvc.SaveScenarioNote(scenario, notes, sens)
}

// SaveSessionNote persists a user name and notes for a session.
func (a *App) SaveSessionNote(sessionID, name, notes string) error {
	return a.trackingSvc.SaveSessionNote(sessionID, name, notes)
}

// ClearCache clears the application cache.
func (a *App) ClearCache() error {
	// This triggers callbacks registered via cache.RegisterOnClear
	if err := a.cacheSvc.ClearAll(); err != nil {
		return err
	}
	return nil
}

// GetScenarioTrace retrieves the binary trace data for a scenario, encoded as Base64.
// This is called lazily by the frontend when the user views the trace tab.
func (a *App) GetScenarioTrace(fileName string) (string, error) {
	if !a.tracesSvc.Exists(fileName) {
		return "", fmt.Errorf("trace not found")
	}
	data, err := a.tracesSvc.Load(fileName)
	if err != nil {
		return "", err
	}
	return traces.EncodeTraceBase64(data.MouseTrace)
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

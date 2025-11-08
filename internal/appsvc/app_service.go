package appsvc

import (
	"context"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/mouse"
	appsettings "refleks/internal/settings"
	"refleks/internal/traces"
)

// AppService coordinates mouse, watcher and updater services and centralizes
// settings-related side effects so `app.go` remains small and focused on IPC.
type AppService struct {
	ctx      context.Context
	watcher  *WatcherService
	updater  *UpdaterService
	mouse    mouse.Provider
	settings *models.Settings
}

// NewAppService constructs and wires the subservices.
func NewAppService(ctx context.Context, settings *models.Settings) *AppService {
	svc := &AppService{ctx: ctx, settings: settings}
	// Mouse provider initialization (platform-specific noop on non-Windows)
	svc.mouse = mouse.New(constants.DefaultMouseSampleHz)
	if settings != nil {
		svc.mouse.SetBufferDuration(time.Duration(settings.MouseBufferMinutes) * time.Minute)
		if settings.MouseTrackingEnabled {
			if err := svc.mouse.Start(); err != nil {
				runtime.LogWarningf(ctx, "mouse tracker start failed: %v", err)
			} else {
				runtime.LogInfo(ctx, "mouse tracker started")
			}
		}
	}
	svc.watcher = NewWatcherService(ctx)
	svc.watcher.SetMouseProvider(svc.mouse)
	svc.updater = NewUpdaterService(constants.GitHubOwner, constants.GitHubRepo, constants.AppVersion)
	return svc
}

// CheckForUpdates delegates to the updater service.
func (s *AppService) CheckForUpdates(ctx context.Context) (models.UpdateInfo, error) {
	return s.updater.CheckForUpdates(ctx)
}

// DownloadAndInstallUpdate delegates to the updater service.
func (s *AppService) DownloadAndInstallUpdate(ctx context.Context, version string) error {
	return s.updater.DownloadAndInstallUpdate(ctx, version)
}

// StartWatcher starts the watcher using the stored settings and mouse provider.
func (s *AppService) StartWatcher(path string) (bool, string) {
	if s.settings == nil {
		return false, "missing settings"
	}
	return s.watcher.Start(path, s.settings, s.mouse)
}

// StopWatcher stops the watcher.
func (s *AppService) StopWatcher() (bool, string) {
	return s.watcher.Stop()
}

// GetRecent returns recent scenarios.
func (s *AppService) GetRecent(limit int) []models.ScenarioRecord {
	return s.watcher.GetRecent(limit)
}

// IsWatcherRunning indicates if the watcher loop is active.
func (s *AppService) IsWatcherRunning() bool {
	return s.watcher.IsRunning()
}

// UpdateSettings applies the given settings object, persists it, and updates
// sub-services (mouse, watcher, traces) to reflect the change.
func (s *AppService) UpdateSettings(newS models.Settings) (bool, string) {
	newS = appsettings.Sanitize(newS)
	prevTraces := ""
	if s.settings != nil {
		prevTraces = s.settings.TracesDir
		// carry over favorites if omitted
		if len(newS.FavoriteBenchmarks) == 0 && len(s.settings.FavoriteBenchmarks) > 0 {
			newS.FavoriteBenchmarks = s.settings.FavoriteBenchmarks
		}
	}
	// replace in-place so callers holding the pointer observe the change
	if s.settings != nil {
		*s.settings = newS
	}
	if err := appsettings.Save(newS); err != nil {
		return false, err.Error()
	}
	// Apply to mouse provider
	if s.mouse == nil {
		s.mouse = mouse.New(constants.DefaultMouseSampleHz)
	}
	s.mouse.SetBufferDuration(time.Duration(newS.MouseBufferMinutes) * time.Minute)
	if newS.MouseTrackingEnabled {
		if !s.mouse.Enabled() {
			if err := s.mouse.Start(); err != nil {
				runtime.LogWarningf(s.ctx, "mouse tracker start failed: %v", err)
			}
		}
	} else {
		if s.mouse.Enabled() {
			s.mouse.Stop()
		}
	}

	// Ensure watcher reflects latest settings. If running, restart with new config; if stopped, just update config.
	if s.watcher != nil {
		cfg := models.WatcherConfig{
			Path:                 newS.StatsDir,
			SessionGap:           time.Duration(newS.SessionGapMinutes) * time.Minute,
			PollInterval:         time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
			ParseExistingOnStart: true,
			ParseExistingLimit:   newS.MaxExistingOnStart,
		}
		if s.watcher.IsRunning() {
			_, _ = s.watcher.Stop()
			if err := s.watcher.UpdateConfig(cfg); err != nil {
				return false, err.Error()
			}
			s.watcher.Clear()
			if s.mouse != nil {
				s.watcher.SetMouseProvider(s.mouse)
			}
			if ok, msg := s.watcher.Start(newS.StatsDir, s.settings, s.mouse); !ok {
				runtime.LogErrorf(s.ctx, "Watcher restart error: %s", msg)
				return false, msg
			}
		} else {
			if err := s.watcher.UpdateConfig(cfg); err != nil {
				return false, err.Error()
			}
			s.watcher.Clear()
			if s.mouse != nil {
				s.watcher.SetMouseProvider(s.mouse)
			}
		}
	}

	// Apply traces directory override for persistence and reload if changed
	tracesDir := appsettings.ExpandPathPlaceholders(newS.TracesDir)
	traces.SetBaseDir(tracesDir)
	if s.watcher != nil && appsettings.ExpandPathPlaceholders(prevTraces) != tracesDir {
		n := s.watcher.ReloadTraces()
		runtime.LogInfof(s.ctx, "reloaded traces for %d scenarios after tracesDir change", n)
	}
	return true, "ok"
}

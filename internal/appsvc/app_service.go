package appsvc

import (
	"context"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/benchmarks"
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
	svc.watcher.SetOnScenarioParsed(func(rec models.ScenarioRecord) {
		benchmarks.CheckAndRefreshIfNeeded(rec)
	})

	benchmarks.SetOnProgressUpdated(func(id int, p models.BenchmarkProgress) {
		runtime.EventsEmit(ctx, fmt.Sprintf("benchmark:progress:%d", id), p)
		runtime.EventsEmit(ctx, "benchmark:progress:updated", map[string]interface{}{
			"id":       id,
			"progress": p,
		})
	})

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
	return s.OverwriteSettings(newS)
}

// OverwriteSettings applies the given settings object exactly as provided (after sanitization),
// persists it, and updates sub-services. It does NOT merge with previous settings.
func (s *AppService) OverwriteSettings(newS models.Settings) (bool, string) {
	newS = appsettings.Sanitize(newS)

	var prevSettings models.Settings
	hasPrev := false
	if s.settings != nil {
		prevSettings = *s.settings
		hasPrev = true
	}

	// replace in-place so callers holding the pointer observe the change
	if s.settings != nil {
		*s.settings = newS
	} else {
		s.settings = &newS
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

	// Determine if we need to restart the watcher (which triggers a full reload of stats)
	needsWatcherRestart := true
	if hasPrev {
		// Only restart if core watcher config changed
		if prevSettings.StatsDir == newS.StatsDir &&
			prevSettings.SessionGapMinutes == newS.SessionGapMinutes &&
			prevSettings.MaxExistingOnStart == newS.MaxExistingOnStart {
			needsWatcherRestart = false
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

		if needsWatcherRestart {
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
		} else {
			// If not restarting, try to update config if stopped (safe).
			// If running, we can't update config, but since we determined needsWatcherRestart=false,
			// the relevant config parts haven't changed anyway.
			if !s.watcher.IsRunning() {
				_ = s.watcher.UpdateConfig(cfg)
			}
		}
	}

	// Apply traces directory override for persistence and reload if changed
	tracesDir := appsettings.ExpandPathPlaceholders(newS.TracesDir)
	traces.SetBaseDir(tracesDir)
	prevTraces := ""
	if hasPrev {
		prevTraces = prevSettings.TracesDir
	}
	if s.watcher != nil && appsettings.ExpandPathPlaceholders(prevTraces) != tracesDir {
		n := s.watcher.ReloadTraces()
		runtime.LogInfof(s.ctx, "reloaded traces for %d scenarios after tracesDir change", n)
	}
	return true, "ok"
}

// SaveScenarioNote updates the note and sensitivity for a specific scenario.
func (s *AppService) SaveScenarioNote(scenario, notes, sens string) (bool, string) {
	if s.settings == nil {
		return false, "settings not loaded"
	}
	if s.settings.ScenarioNotes == nil {
		s.settings.ScenarioNotes = make(map[string]models.ScenarioNote)
	}
	s.settings.ScenarioNotes[scenario] = models.ScenarioNote{
		Notes: notes,
		Sens:  sens,
	}
	if err := appsettings.Save(*s.settings); err != nil {
		return false, err.Error()
	}
	return true, ""
}

// SaveSessionNote updates the name and notes for a specific session.
// This triggers a rebuild of bindings.
func (s *AppService) SaveSessionNote(sessionID, name, notes string) (bool, string) {
	if s.settings == nil {
		return false, "settings not loaded"
	}
	if s.settings.SessionNotes == nil {
		s.settings.SessionNotes = make(map[string]models.SessionNote)
	}
	s.settings.SessionNotes[sessionID] = models.SessionNote{
		Name:  name,
		Notes: notes,
	}
	if err := appsettings.Save(*s.settings); err != nil {
		return false, err.Error()
	}
	return true, ""
}

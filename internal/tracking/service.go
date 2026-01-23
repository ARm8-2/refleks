package tracking

import (
	"context"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/benchmarks"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/mouse"
	"refleks/internal/process"
	appsettings "refleks/internal/settings"
	"refleks/internal/traces"
	"refleks/internal/watcher"
)

// Service coordinates mouse and watcher services.
type Service struct {
	ctx             context.Context
	watcher         *watcher.Watcher
	mouse           mouse.Provider
	settingsSvc     *appsettings.Service
	benchmarkSvc    *benchmarks.Service
	tracesSvc       *traces.Service
	procWatcher     *process.Watcher
	procWatcherStop context.CancelFunc
}

// NewService constructs and wires the subservices.
func NewService(ctx context.Context, settingsSvc *appsettings.Service, benchmarkSvc *benchmarks.Service, tracesSvc *traces.Service) *Service {
	svc := &Service{
		ctx:          ctx,
		settingsSvc:  settingsSvc,
		benchmarkSvc: benchmarkSvc,
		tracesSvc:    tracesSvc,
	}

	settings := settingsSvc.Get()

	// Mouse provider initialization
	svc.mouse = mouse.New(constants.DefaultMouseSampleHz)
	svc.mouse.SetBufferDuration(time.Duration(settings.MouseBufferMinutes) * time.Minute)
	if settings.MouseTrackingEnabled {
		svc.startMouseProcessWatcher()
	}

	// Initialize Watcher with default/current settings
	defaultCfg := models.WatcherConfig{
		Path:                 settings.StatsDir,
		SessionGap:           time.Duration(settings.SessionGapMinutes) * time.Minute,
		PollInterval:         time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		ParseExistingOnStart: true,
		ParseExistingLimit:   settings.MaxExistingOnStart,
	}

	svc.watcher = watcher.New(ctx, defaultCfg, tracesSvc)
	svc.watcher.SetMouseProvider(svc.mouse)
	svc.watcher.SetOnScenarioParsed(func(rec models.ScenarioRecord) {
		benchmarkSvc.CheckAndRefreshIfNeeded(rec)
	})

	benchmarkSvc.SetOnProgressUpdated(func(id int, p models.BenchmarkProgress) {
		runtime.EventsEmit(ctx, fmt.Sprintf("%s%d", constants.EventBenchmarkProgressPrefix, id), p)
		runtime.EventsEmit(ctx, constants.EventBenchmarkProgressUpdated, map[string]interface{}{
			"id":       id,
			"progress": p,
		})
	})

	return svc
}

// StartWatcher starts the watcher using the stored settings and mouse provider.
func (s *Service) StartWatcher(path string) error {
	current := s.settingsSvc.Get()
	if path != "" {
		current.StatsDir = path
		if err := s.settingsSvc.Update(current); err != nil {
			return err
		}
		current = s.settingsSvc.Get()
	}

	// Configure watcher
	finalPath := current.StatsDir
	if finalPath == "" {
		finalPath = appsettings.DefaultStatsDir()
	}

	cfg := models.WatcherConfig{
		Path:                 finalPath,
		SessionGap:           time.Duration(current.SessionGapMinutes) * time.Minute,
		PollInterval:         time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		ParseExistingOnStart: true,
		ParseExistingLimit:   current.MaxExistingOnStart,
	}

	if s.watcher == nil {
		// Should have been initialized in NewService, but just in case
		s.watcher = watcher.New(s.ctx, cfg, s.tracesSvc)
		s.watcher.SetMouseProvider(s.mouse)
		s.watcher.SetOnScenarioParsed(func(rec models.ScenarioRecord) {
			s.benchmarkSvc.CheckAndRefreshIfNeeded(rec)
		})
	} else {
		if err := s.watcher.UpdateConfig(cfg); err != nil {
			return err
		}
		s.watcher.Clear()
	}

	if err := s.watcher.Start(); err != nil {
		runtime.LogErrorf(s.ctx, "Watcher start error: %v", err)
		return err
	}
	return nil
}

// StopWatcher stops the watcher.
func (s *Service) StopWatcher() error {
	if s.watcher == nil {
		return nil
	}
	return s.watcher.Stop()
}

// GetRecent returns recent scenarios.
func (s *Service) GetRecent(limit int) []models.ScenarioRecord {
	if s.watcher == nil {
		return nil
	}
	return s.watcher.GetRecent(limit)
}

// IsWatcherRunning indicates if the watcher loop is active.
func (s *Service) IsWatcherRunning() bool {
	if s.watcher == nil {
		return false
	}
	return s.watcher.IsRunning()
}

// UpdateSettings applies the given settings object, persists it, and updates
// sub-services (mouse, watcher, traces) to reflect the change.
func (s *Service) UpdateSettings(newS models.Settings) error {
	return s.OverwriteSettings(newS)
}

// OverwriteSettings applies the given settings object exactly as provided.
func (s *Service) OverwriteSettings(newS models.Settings) error {
	prevSettings := s.settingsSvc.Get()

	// Persist new settings
	if err := s.settingsSvc.Update(newS); err != nil {
		return err
	}

	// Re-fetch sanitized settings
	newS = s.settingsSvc.Get()

	// Apply to mouse provider
	if s.mouse == nil {
		s.mouse = mouse.New(constants.DefaultMouseSampleHz)
	}
	s.mouse.SetBufferDuration(time.Duration(newS.MouseBufferMinutes) * time.Minute)

	// Handle mouse tracking state change
	if newS.MouseTrackingEnabled != prevSettings.MouseTrackingEnabled {
		if newS.MouseTrackingEnabled {
			s.startMouseProcessWatcher()
		} else {
			s.stopMouseProcessWatcher()
		}
	}

	// Determine if we need to restart the watcher
	needsWatcherRestart := true
	// Only restart if core watcher config changed
	if prevSettings.StatsDir == newS.StatsDir &&
		prevSettings.SessionGapMinutes == newS.SessionGapMinutes &&
		prevSettings.MaxExistingOnStart == newS.MaxExistingOnStart {
		needsWatcherRestart = false
	}

	// Ensure watcher reflects latest settings
	if err := s.updateWatcher(newS, needsWatcherRestart); err != nil {
		return err
	}

	// Apply traces directory override
	tracesDir := appsettings.ExpandPathPlaceholders(newS.TracesDir)
	s.tracesSvc.SetBaseDir(tracesDir)

	prevTraces := prevSettings.TracesDir
	if s.watcher != nil && appsettings.ExpandPathPlaceholders(prevTraces) != tracesDir {
		n := s.watcher.ReloadTraces()
		runtime.LogInfof(s.ctx, "reloaded traces for %d scenarios after tracesDir change", n)
	}
	return nil
}

// updateWatcher handles restarting or reconfiguring the watcher based on settings changes.
func (s *Service) updateWatcher(newS models.Settings, needsRestart bool) error {
	if s.watcher == nil {
		return nil
	}
	cfg := models.WatcherConfig{
		Path:                 newS.StatsDir,
		SessionGap:           time.Duration(newS.SessionGapMinutes) * time.Minute,
		PollInterval:         time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		ParseExistingOnStart: true,
		ParseExistingLimit:   newS.MaxExistingOnStart,
	}

	if needsRestart {
		if s.watcher.IsRunning() {
			_ = s.watcher.Stop()
			if err := s.watcher.UpdateConfig(cfg); err != nil {
				return err
			}
			s.watcher.Clear()
			// Mouse provider is already set on s.watcher
			if err := s.watcher.Start(); err != nil {
				runtime.LogErrorf(s.ctx, "Watcher restart error: %v", err)
				return err
			}
		} else {
			if err := s.watcher.UpdateConfig(cfg); err != nil {
				return err
			}
			s.watcher.Clear()
		}
	} else {
		if !s.watcher.IsRunning() {
			_ = s.watcher.UpdateConfig(cfg)
		}
	}
	return nil
}

// SaveScenarioNote updates the note and sensitivity for a specific scenario.
func (s *Service) SaveScenarioNote(scenario, notes, sens string) error {
	current := s.settingsSvc.Get()
	if current.ScenarioNotes == nil {
		current.ScenarioNotes = make(map[string]models.ScenarioNote)
	}
	current.ScenarioNotes[scenario] = models.ScenarioNote{
		Notes: notes,
		Sens:  sens,
	}
	return s.settingsSvc.Update(current)
}

// SaveSessionNote updates the name and notes for a specific session.
func (s *Service) SaveSessionNote(sessionID, name, notes string) error {
	current := s.settingsSvc.Get()
	if current.SessionNotes == nil {
		current.SessionNotes = make(map[string]models.SessionNote)
	}
	current.SessionNotes[sessionID] = models.SessionNote{
		Name:  name,
		Notes: notes,
	}
	return s.settingsSvc.Update(current)
}

// startMouseProcessWatcher starts the process watcher that controls mouse tracking.
// Mouse tracking only runs when Kovaak's (FPSAimTrainer.exe) is running.
func (s *Service) startMouseProcessWatcher() {
	if s.procWatcherStop != nil {
		return // Already running
	}

	ctx, cancel := context.WithCancel(s.ctx)
	s.procWatcherStop = cancel

	s.procWatcher = process.NewWatcher(constants.KovaaksProcessName,
		func() {
			// Kovaak's started - start mouse tracking
			if err := s.mouse.Start(); err != nil {
				runtime.LogWarningf(s.ctx, "mouse tracker start failed: %v", err)
			} else {
				runtime.LogInfo(s.ctx, "mouse tracker started (process detected)")
			}
		},
		func() {
			// Kovaak's stopped - stop mouse tracking
			s.mouse.Stop()
			runtime.LogInfo(s.ctx, "mouse tracker stopped (process exited)")
		},
	)
	go s.procWatcher.Start(ctx)
}

// stopMouseProcessWatcher stops the process watcher and ensures mouse tracking is stopped.
func (s *Service) stopMouseProcessWatcher() {
	if s.procWatcherStop != nil {
		s.procWatcherStop()
		s.procWatcherStop = nil
	}
	s.procWatcher = nil

	// Ensure mouse tracking is stopped
	if s.mouse != nil && s.mouse.Enabled() {
		s.mouse.Stop()
		runtime.LogInfo(s.ctx, "mouse tracker stopped (tracking disabled)")
	}
}

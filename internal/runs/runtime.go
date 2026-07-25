package runs

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/benchmarks"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/process"
	"refleks/internal/runs/mouse"
	"refleks/internal/runs/screen"
	appsettings "refleks/internal/settings"
	"refleks/internal/watcher"
)

// RuntimeService coordinates watcher, mouse tracking, and screen capture around the run store.
type RuntimeService struct {
	ctx             context.Context
	watcher         *watcher.Watcher
	mouse           mouse.Provider
	screen          screen.Provider
	encoder         *screen.Encoder
	runSyncClient   *CloudSyncClient
	settingsSvc     *appsettings.Service
	benchmarkSvc    *benchmarks.Service
	runStore        *Store
	procWatcher     *process.Watcher
	procWatcherStop context.CancelFunc
}

// NewRuntimeService constructs the runtime orchestration service for runs.
func NewRuntimeService(ctx context.Context, settingsSvc *appsettings.Service, benchmarkSvc *benchmarks.Service, runStore *Store) *RuntimeService {
	svc := &RuntimeService{
		ctx:           ctx,
		settingsSvc:   settingsSvc,
		benchmarkSvc:  benchmarkSvc,
		runStore:      runStore,
		runSyncClient: NewCloudSyncClient(),
	}

	settings := settingsSvc.Get()

	svc.mouse = mouse.New(constants.DefaultMouseSampleHz)
	svc.mouse.SetBufferDuration(time.Duration(settings.MouseBufferMinutes) * time.Minute)

	svc.screen = screen.New(ctx)
	svc.encoder = screen.NewEncoder()
	svc.runStore.SetScreenCapture(ctx, svc.screen, svc.encoder)

	if settings.MouseTrackingEnabled || settings.ScreenCaptureEnabled {
		runtime.LogInfof(ctx, "runs: starting process watcher (mouse=%v screen=%v)", settings.MouseTrackingEnabled, settings.ScreenCaptureEnabled)
		svc.startProcessWatcher()
	}

	defaultCfg := models.WatcherConfig{
		Path:               appsettings.ResolveKovaaksStatsDir(settings.KovaaksInstallDir),
		SessionGap:         time.Duration(settings.SessionGapMinutes) * time.Minute,
		PollInterval:       time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		RecentRunsDays:     settings.RecentRunsDays,
		RecentRunsMinCount: settings.RecentRunsMinCount,
	}

	svc.watcher = watcher.New(ctx, defaultCfg, runStore)
	svc.watcher.SetMouseProvider(svc.mouse)
	svc.watcher.SetOnRunParsed(func(rec models.RunRecord) {
		svc.handleRunParsed(rec)
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

// StartWatcher starts the file watcher with the currently configured settings.
func (s *RuntimeService) StartWatcher() error {
	current := s.settingsSvc.Get()
	finalPath := appsettings.ResolveKovaaksStatsDir(current.KovaaksInstallDir)
	if finalPath == "" {
		finalPath = appsettings.ResolveKovaaksStatsDir(appsettings.DefaultKovaaksInstallDir())
	}

	cfg := models.WatcherConfig{
		Path:               finalPath,
		SessionGap:         time.Duration(current.SessionGapMinutes) * time.Minute,
		PollInterval:       time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		RecentRunsDays:     current.RecentRunsDays,
		RecentRunsMinCount: current.RecentRunsMinCount,
	}

	if s.watcher == nil {
		s.watcher = watcher.New(s.ctx, cfg, s.runStore)
		s.watcher.SetMouseProvider(s.mouse)
		s.watcher.SetOnRunParsed(func(rec models.RunRecord) {
			s.handleRunParsed(rec)
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

// StartWatcherAt updates the Kovaak's install directory and starts the file watcher.
// Pass an empty string to keep the current directory.
func (s *RuntimeService) StartWatcherAt(installDir string) error {
	if installDir != "" {
		current := s.settingsSvc.Get()
		current.KovaaksInstallDir = installDir
		if err := s.settingsSvc.Update(current); err != nil {
			return err
		}
	}
	return s.StartWatcher()
}

func (s *RuntimeService) StopWatcher() error {
	if s.watcher == nil {
		return nil
	}
	return s.watcher.Stop()
}

func (s *RuntimeService) GetRecent(limit int) []models.RunRecord {
	if s.runStore == nil {
		return nil
	}
	if limit < 0 {
		limit = 0
	}
	records, err := s.runStore.LoadRecentRuns(limit)
	if err != nil {
		runtime.LogWarningf(s.ctx, "failed to load recent runs: %v", err)
		return nil
	}

	for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
		records[i], records[j] = records[j], records[i]
	}
	return records
}

func (s *RuntimeService) IsWatcherRunning() bool {
	if s.watcher == nil {
		return false
	}
	return s.watcher.IsRunning()
}

func (s *RuntimeService) UpdateSettings(newS models.Settings) error {
	return s.OverwriteSettings(newS)
}

func (s *RuntimeService) OverwriteSettings(newS models.Settings) error {
	prevSettings := s.settingsSvc.Get()

	if err := s.settingsSvc.Update(newS); err != nil {
		return err
	}
	newS = s.settingsSvc.Get()

	if s.mouse == nil {
		s.mouse = mouse.New(constants.DefaultMouseSampleHz)
	}
	s.mouse.SetBufferDuration(time.Duration(newS.MouseBufferMinutes) * time.Minute)

	trackingChanged := newS.MouseTrackingEnabled != prevSettings.MouseTrackingEnabled
	captureChanged := newS.ScreenCaptureEnabled != prevSettings.ScreenCaptureEnabled

	if trackingChanged || captureChanged {
		if newS.MouseTrackingEnabled || newS.ScreenCaptureEnabled {
			s.startProcessWatcher()
		} else {
			s.stopProcessWatcher()
		}
	}

	// Handle screen capture toggle while watcher is already running
	// (e.g. user enables capture mid-session — the watcher won't re-fire onStart)
	if captureChanged && s.procWatcherStop != nil {
		if newS.ScreenCaptureEnabled {
			if s.encoder != nil && s.encoder.Available() {
				screen.SetCaptureEncoder(s.screen, s.encoder.Info().EncoderName)
			}
			screen.SetCaptureFPS(s.screen, newS.ScreenCaptureFPS)
			screen.SetCaptureResolution(s.screen, newS.ScreenCaptureResolution)
			if process.IsRunning(constants.KovaaksProcessName) {
				if err := s.screen.Start(); err != nil {
					runtime.LogWarningf(s.ctx, "screen capture start failed: %v", err)
				} else {
					runtime.LogInfo(s.ctx, "screen capture started (settings changed)")
				}
			}
		} else {
			if s.screen != nil && s.screen.Enabled() {
				s.screen.Stop()
				runtime.LogInfo(s.ctx, "screen capture stopped (settings changed)")
			}
			s.finalizeScreenCapture()
		}
	}

	needsWatcherRestart := true
	if prevSettings.KovaaksInstallDir == newS.KovaaksInstallDir &&
		prevSettings.SessionGapMinutes == newS.SessionGapMinutes &&
		prevSettings.RecentRunsDays == newS.RecentRunsDays &&
		prevSettings.RecentRunsMinCount == newS.RecentRunsMinCount {
		needsWatcherRestart = false
	}

	if err := s.updateWatcher(newS, needsWatcherRestart); err != nil {
		return err
	}
	return nil
}

func (s *RuntimeService) updateWatcher(newS models.Settings, needsRestart bool) error {
	if s.watcher == nil {
		return nil
	}

	cfg := models.WatcherConfig{
		Path:               appsettings.ResolveKovaaksStatsDir(newS.KovaaksInstallDir),
		SessionGap:         time.Duration(newS.SessionGapMinutes) * time.Minute,
		PollInterval:       time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		RecentRunsDays:     newS.RecentRunsDays,
		RecentRunsMinCount: newS.RecentRunsMinCount,
	}

	if needsRestart {
		if s.watcher.IsRunning() {
			_ = s.watcher.Stop()
			if err := s.watcher.UpdateConfig(cfg); err != nil {
				return err
			}
			s.watcher.Clear()
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

func (s *RuntimeService) SaveScenarioNote(scenario, notes, sens string) error {
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

func (s *RuntimeService) SaveSessionNote(sessionID, name, notes string) error {
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

func (s *RuntimeService) handleRunParsed(rec models.RunRecord) {
	s.benchmarkSvc.CheckAndRefreshIfNeeded(rec)
	settings := s.settingsSvc.Get()
	if !settings.RunSyncEnabled {
		return
	}

	if s.runSyncClient == nil || strings.TrimSpace(rec.FilePath) == "" {
		return
	}

	go func(path string, anonymous bool) {
		if err := s.runSyncClient.SyncRunFile(s.ctx, path, anonymous); err != nil {
			runtime.LogWarningf(s.ctx, "run sync failed for %s: %v", path, err)
		}
	}(rec.FilePath, settings.AnonymousEnabled)
}

func (s *RuntimeService) startProcessWatcher() {
	if s.procWatcherStop != nil {
		return
	}

	ctx, cancel := context.WithCancel(s.ctx)
	s.procWatcherStop = cancel

	s.procWatcher = process.NewWatcher(constants.KovaaksProcessName,
		func() {
			runtime.LogInfo(s.ctx, "watcher: KovaaK's process detected (onStart)")
			cur := s.settingsSvc.Get()
			runtime.LogInfof(s.ctx, "watcher: mouseTracking=%v screenCapture=%v", cur.MouseTrackingEnabled, cur.ScreenCaptureEnabled)
			if cur.MouseTrackingEnabled {
				if err := s.mouse.Start(); err != nil {
					runtime.LogWarningf(s.ctx, "mouse tracker start failed: %v", err)
				} else {
					runtime.LogInfo(s.ctx, "mouse tracker started (process detected)")
				}
			}
			if cur.ScreenCaptureEnabled {
				runtime.LogInfo(s.ctx, "watcher: starting screen capture")
				if s.encoder != nil && s.encoder.Available() {
					screen.SetCaptureEncoder(s.screen, s.encoder.Info().EncoderName)
				}
				screen.SetCaptureFPS(s.screen, cur.ScreenCaptureFPS)
				screen.SetCaptureResolution(s.screen, cur.ScreenCaptureResolution)
				if err := s.screen.Start(); err != nil {
					runtime.LogWarningf(s.ctx, "screen capture start failed: %v", err)
				} else {
					runtime.LogInfo(s.ctx, "screen capture started (process detected)")
				}
			}
		},
		func() {
			runtime.LogInfo(s.ctx, "watcher: KovaaK's process exited (onStop)")
			if s.mouse.Enabled() {
				s.mouse.Stop()
				runtime.LogInfo(s.ctx, "mouse tracker stopped (process exited)")
			}
			if s.screen.Enabled() {
				runtime.LogInfo(s.ctx, "watcher: stopping screen capture")
				s.screen.Stop()
				runtime.LogInfo(s.ctx, "screen capture stopped (process exited)")
			} else {
				runtime.LogDebug(s.ctx, "watcher: screen capture was not enabled, skipping stop")
			}

			// Stop finalizes the temp recording, then scan after a short delay so
			// KovaaK's has finished closing the stats files. Finalization trims
			// both runs found by this scan and runs queued by earlier fsnotify
			// events while capture was still active.
			time.Sleep(500 * time.Millisecond)
			s.finalizeScreenCapture()
		},
	)
	go s.procWatcher.Start(ctx)
}

// Shutdown stops capture on a real app exit and then removes its temporary
// segment directories. Any trim that has not already published is intentionally
// abandoned: the process is exiting and cannot reliably finish publishing it.
// Startup cleanup remains the fallback for files locked by a child process or
// an externally terminated RefleK's process.
func (s *RuntimeService) Shutdown() {
	s.stopProcessWatcher()
	if err := screen.CleanupAbandonedSessions(); err != nil {
		runtime.LogWarningf(s.ctx, "screen: clean capture sessions on shutdown: %v", err)
	}
}

func (s *RuntimeService) stopProcessWatcher() {
	if s.procWatcherStop != nil {
		s.procWatcherStop()
		s.procWatcherStop = nil
	}
	s.procWatcher = nil

	if s.mouse != nil && s.mouse.Enabled() {
		s.mouse.Stop()
		runtime.LogInfo(s.ctx, "mouse tracker stopped (tracking disabled)")
	}
	if s.screen != nil && s.screen.Enabled() {
		s.screen.Stop()
		runtime.LogInfo(s.ctx, "screen capture stopped (tracking disabled)")
	}
	s.finalizeScreenCapture()
}

// finalizeScreenCapture waits for in-progress watcher ingestion to register
// its trim before the provider can release a stopped session. This is needed
// for both process exit and capture being disabled from settings.
func (s *RuntimeService) finalizeScreenCapture() {
	if s.watcher != nil {
		// Scan synchronously, then wait for any concurrent fsnotify ingestion.
		// This makes settings-disable and app-shutdown retain the same final-run
		// guarantee as normal process exit.
		s.watcher.ScanNow()
		idleCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		idle := s.watcher.WaitForIdle(idleCtx)
		cancel()
		if !idle {
			runtime.LogWarning(s.ctx, "watcher: timed out waiting for final run ingestion")
		}
	}
	if s.runStore != nil {
		s.runStore.FinalizeScreenCapture()
	}
}

// ScreenCaptureProvider exposes screen capture frames for ingest.
func (s *RuntimeService) ScreenCaptureProvider() screen.Provider {
	return s.screen
}

// Encoder returns the configured video encoder.
func (s *RuntimeService) Encoder() *screen.Encoder {
	return s.encoder
}

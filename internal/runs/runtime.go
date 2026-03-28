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
	appsettings "refleks/internal/settings"
	"refleks/internal/watcher"
)

// RuntimeService coordinates watcher and mouse tracking around the run store.
type RuntimeService struct {
	ctx             context.Context
	watcher         *watcher.Watcher
	mouse           mouse.Provider
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
	if settings.MouseTrackingEnabled {
		svc.startMouseProcessWatcher()
	}

	defaultCfg := models.WatcherConfig{
		Path:               settings.StatsDir,
		SessionGap:         time.Duration(settings.SessionGapMinutes) * time.Minute,
		PollInterval:       time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		RecentRunsDays:     settings.RecentRunsDays,
		RecentRunsMinCount: settings.RecentRunsMinCount,
	}

	svc.watcher = watcher.New(ctx, defaultCfg, runStore)
	svc.watcher.SetMouseProvider(svc.mouse)
	svc.watcher.SetOnScenarioParsed(func(rec models.ScenarioRecord) {
		svc.handleScenarioParsed(rec)
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

func (s *RuntimeService) StartWatcher(path string) error {
	current := s.settingsSvc.Get()
	if path != "" {
		current.StatsDir = path
		if err := s.settingsSvc.Update(current); err != nil {
			return err
		}
		current = s.settingsSvc.Get()
	}

	finalPath := current.StatsDir
	if finalPath == "" {
		finalPath = appsettings.DefaultStatsDir()
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
		s.watcher.SetOnScenarioParsed(func(rec models.ScenarioRecord) {
			s.handleScenarioParsed(rec)
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

func (s *RuntimeService) StopWatcher() error {
	if s.watcher == nil {
		return nil
	}
	return s.watcher.Stop()
}

func (s *RuntimeService) GetRecent(limit int) []models.ScenarioRecord {
	if s.runStore == nil {
		return nil
	}
	if limit < 0 {
		limit = 0
	}
	records, err := s.runStore.LoadRecentScenarios(limit)
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

	if newS.MouseTrackingEnabled != prevSettings.MouseTrackingEnabled {
		if newS.MouseTrackingEnabled {
			s.startMouseProcessWatcher()
		} else {
			s.stopMouseProcessWatcher()
		}
	}

	needsWatcherRestart := true
	if prevSettings.StatsDir == newS.StatsDir &&
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
		Path:               newS.StatsDir,
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

func (s *RuntimeService) handleScenarioParsed(rec models.ScenarioRecord) {
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

func (s *RuntimeService) startMouseProcessWatcher() {
	if s.procWatcherStop != nil {
		return
	}

	ctx, cancel := context.WithCancel(s.ctx)
	s.procWatcherStop = cancel

	s.procWatcher = process.NewWatcher(constants.KovaaksProcessName,
		func() {
			if err := s.mouse.Start(); err != nil {
				runtime.LogWarningf(s.ctx, "mouse tracker start failed: %v", err)
			} else {
				runtime.LogInfo(s.ctx, "mouse tracker started (process detected)")
			}
		},
		func() {
			s.mouse.Stop()
			runtime.LogInfo(s.ctx, "mouse tracker stopped (process exited)")
		},
	)
	go s.procWatcher.Start(ctx)
}

func (s *RuntimeService) stopMouseProcessWatcher() {
	if s.procWatcherStop != nil {
		s.procWatcherStop()
		s.procWatcherStop = nil
	}
	s.procWatcher = nil

	if s.mouse != nil && s.mouse.Enabled() {
		s.mouse.Stop()
		runtime.LogInfo(s.ctx, "mouse tracker stopped (tracking disabled)")
	}
}

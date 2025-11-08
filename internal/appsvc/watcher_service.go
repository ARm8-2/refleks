package appsvc

import (
	"context"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/mouse"
	"refleks/internal/settings"
	"refleks/internal/watcher"
)

// WatcherService wraps the watcher.Watcher and provides a smaller surface for app.go.
type WatcherService struct {
	ctx context.Context
	w   *watcher.Watcher
}

// NewWatcherService creates a new service bound to the provided context.
func NewWatcherService(ctx context.Context) *WatcherService {
	return &WatcherService{ctx: ctx}
}

// Start begins monitoring the given path. If path is empty, the settings' StatsDir or default is used.
// The provided settings pointer will be mutated/persisted when the path is explicitly provided.
func (s *WatcherService) Start(path string, cfgSettings *models.Settings, mouseProv mouse.Provider) (bool, string) {
	if cfgSettings == nil {
		return false, "missing settings"
	}
	if path == "" {
		if cfgSettings.StatsDir != "" {
			path = cfgSettings.StatsDir
		} else {
			path = settings.DefaultStatsDir()
		}
	} else {
		cfgSettings.StatsDir = path
		_ = settings.Save(*cfgSettings)
	}
	cfg := models.WatcherConfig{
		Path:                 path,
		SessionGap:           time.Duration(cfgSettings.SessionGapMinutes) * time.Minute,
		PollInterval:         time.Duration(constants.DefaultPollIntervalSeconds) * time.Second,
		ParseExistingOnStart: true,
		ParseExistingLimit:   cfgSettings.MaxExistingOnStart,
	}
	if s.w == nil {
		s.w = watcher.New(s.ctx, cfg)
		if mouseProv != nil {
			s.w.SetMouseProvider(mouseProv)
		}
	} else {
		if err := s.w.UpdateConfig(cfg); err != nil {
			return false, err.Error()
		}
		s.w.Clear()
	}
	if err := s.w.Start(); err != nil {
		runtime.LogErrorf(s.ctx, "Watcher start error: %v", err)
		return false, err.Error()
	}
	return true, "ok"
}

// Stop stops the watcher if running.
func (s *WatcherService) Stop() (bool, string) {
	if s.w == nil {
		return true, "not running"
	}
	if err := s.w.Stop(); err != nil {
		return false, err.Error()
	}
	return true, "stopped"
}

// GetRecent returns most recent parsed scenarios, up to optional limit.
func (s *WatcherService) GetRecent(limit int) []models.ScenarioRecord {
	if s.w == nil {
		return nil
	}
	return s.w.GetRecent(limit)
}

// IsRunning indicates if the watcher loop is active.
func (s *WatcherService) IsRunning() bool {
	if s.w == nil {
		return false
	}
	return s.w.IsRunning()
}

// UpdateConfig updates the watcher's configuration while stopped (or creates the watcher if nil).
func (s *WatcherService) UpdateConfig(cfg models.WatcherConfig) error {
	if s.w == nil {
		s.w = watcher.New(s.ctx, cfg)
		return nil
	}
	return s.w.UpdateConfig(cfg)
}

// Clear clears in-memory state to avoid duplicates on restart.
func (s *WatcherService) Clear() {
	if s.w == nil {
		return
	}
	s.w.Clear()
}

// SetMouseProvider injects a mouse provider for enrichment.
func (s *WatcherService) SetMouseProvider(p mouse.Provider) {
	if s.w == nil {
		return
	}
	s.w.SetMouseProvider(p)
}

// ReloadTraces attempts to load persisted traces; returns number reloaded.
func (s *WatcherService) ReloadTraces() int {
	if s.w == nil {
		return 0
	}
	return s.w.ReloadTraces()
}

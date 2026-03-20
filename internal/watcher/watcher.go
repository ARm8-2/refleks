package watcher

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// Watcher monitors a directory for new stats files and emits events.
type Watcher struct {
	ctx     context.Context
	cfg     models.WatcherConfig
	mu      sync.RWMutex
	running bool
	stopCh  chan struct{}
	seen    map[string]struct{} // full file path set

	recent []models.ScenarioRecord
	mouse  models.MouseTraceProvider
	runSvc RunStore

	OnScenarioParsed func(models.ScenarioRecord)
}

// RunStore persists and loads scenario runs from the source-of-truth storage.
type RunStore interface {
	Exists(statsFileName string) bool
	IngestScenario(fullPath string, mouse models.MouseTraceProvider) (models.ScenarioRecord, error)
	LoadRecentScenarios(limit int) ([]models.ScenarioRecord, error)
}

// New returns a new Watcher with the given config.
func New(ctx context.Context, cfg models.WatcherConfig, runSvc RunStore) *Watcher {
	return &Watcher{
		ctx:    ctx,
		cfg:    cfg,
		stopCh: make(chan struct{}),
		seen:   make(map[string]struct{}),
		runSvc: runSvc,
	}
}

// SetMouseProvider injects a mouse provider to enrich scenario records.
func (w *Watcher) SetMouseProvider(p models.MouseTraceProvider) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.mouse = p
}

// Start begins polling loop. It is safe to call once; subsequent calls return an error.
func (w *Watcher) Start() error {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return nil
	}
	w.running = true
	w.mu.Unlock()

	// Do not create the directory if it doesn't exist. Just log and continue.
	if _, err := os.Stat(w.cfg.Path); err != nil {
		if os.IsNotExist(err) {
			runtime.LogWarningf(w.ctx, "watch path does not exist: %s (will retry)", w.cfg.Path)
		} else {
			runtime.LogWarningf(w.ctx, "watch path not accessible: %s: %v", w.cfg.Path, err)
		}
	}

	w.loadRecentRuns()
	w.markExistingStatsSeen()
	runtime.EventsEmit(w.ctx, constants.EventWatcherStarted, map[string]string{"path": w.cfg.Path})

	go w.loop()
	return nil
}

// Stop stops the watcher.
func (w *Watcher) Stop() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.running {
		return nil
	}
	close(w.stopCh)
	w.running = false
	w.stopCh = make(chan struct{})
	return nil
}

// SetOnScenarioParsed sets the callback for when a scenario is parsed.
func (w *Watcher) SetOnScenarioParsed(fn func(models.ScenarioRecord)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.OnScenarioParsed = fn
}

func (w *Watcher) Clear() {
	w.mu.Lock()
	w.seen = make(map[string]struct{})
	w.recent = nil
	w.mu.Unlock()
}

func (w *Watcher) loop() {
	ticker := time.NewTicker(w.cfg.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			_ = w.scanOnce()
		}
	}
}

// scanOnce lists directory and emits events for newly discovered files.
func (w *Watcher) scanOnce() error {
	if strings.TrimSpace(w.cfg.Path) == "" {
		return nil
	}

	entries, err := os.ReadDir(w.cfg.Path)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !isKovaaksStatsFile(name) {
			continue
		}
		full := filepath.Join(w.cfg.Path, name)

		w.mu.RLock()
		_, known := w.seen[full]
		w.mu.RUnlock()
		if known {
			continue
		}

		if w.runSvc.Exists(name) {
			w.mu.Lock()
			w.seen[full] = struct{}{}
			w.mu.Unlock()
			continue
		}
		rec, err := w.runSvc.IngestScenario(full, w.mouse)
		if err != nil {
			runtime.LogErrorf(w.ctx, "parse error for %s: %v", full, err)
			continue
		}

		w.mu.Lock()
		w.seen[full] = struct{}{}
		w.recent = append(w.recent, rec)
		w.mu.Unlock()

		if w.OnScenarioParsed != nil {
			w.OnScenarioParsed(rec)
		}

		// Emit a flat ScenarioRecord to simplify the IPC contract.
		runtime.EventsEmit(w.ctx, constants.EventScenarioAdded, rec)
	}
	return nil
}

func (w *Watcher) loadRecentRuns() {
	records, err := w.runSvc.LoadRecentScenarios(w.cfg.ParseExistingLimit)
	if err != nil {
		runtime.LogWarningf(w.ctx, "failed to load .refleks runs: %v", err)
		return
	}

	w.mu.Lock()
	w.recent = records
	w.mu.Unlock()
}

func (w *Watcher) markExistingStatsSeen() {
	if strings.TrimSpace(w.cfg.Path) == "" {
		return
	}

	entries, err := os.ReadDir(w.cfg.Path)
	if err != nil {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	for _, e := range entries {
		if e.IsDir() || !isKovaaksStatsFile(e.Name()) {
			continue
		}
		w.seen[filepath.Join(w.cfg.Path, e.Name())] = struct{}{}
	}
}

// GetRecent returns up to limit most recent scenarios.
func (w *Watcher) GetRecent(limit int) []models.ScenarioRecord {
	w.mu.RLock()
	defer w.mu.RUnlock()
	total := len(w.recent)
	if total == 0 {
		return nil
	}
	if limit <= 0 || limit > total {
		limit = total
	}
	out := make([]models.ScenarioRecord, limit)
	// Return most-recent-first: copy from the end backwards
	for i := 0; i < limit; i++ {
		out[i] = w.recent[total-1-i]
	}
	return out
}

// IsRunning indicates if the watcher loop is active.
func (w *Watcher) IsRunning() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.running
}

// UpdateConfig safely updates the watcher configuration while stopped.
func (w *Watcher) UpdateConfig(cfg models.WatcherConfig) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.running {
		return errors.New("cannot update config while running")
	}
	w.cfg = cfg
	return nil
}

// isKovaaksStatsFile reports whether a filename looks like a Kovaak's exported stats csv.
func isKovaaksStatsFile(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, " stats.csv")
}

package watcher

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	goruntime "runtime"
	"runtime/debug"
	"sort"
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
	gen     uint64
	stopCh  chan struct{}
	seen    map[string]struct{} // full file path set
	mouse   models.MouseTraceProvider
	runSvc  RunStore

	OnRunParsed func(models.RunRecord)
}

type ingestOptions struct {
	ignoreSeen   bool
	notifyParsed bool
	emitEvent    bool
}

// RunStore persists and loads runs from the source-of-truth storage.
type RunStore interface {
	Exists(statsFileName string) bool
	IngestRun(fullPath string, mouse models.MouseTraceProvider) (models.RunRecord, error)
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

// SetMouseProvider injects a mouse provider to enrich run records.
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
	w.gen++
	currentGen := w.gen
	w.mu.Unlock()

	// Do not create the directory if it doesn't exist. Just log and continue.
	if _, err := os.Stat(w.cfg.Path); err != nil {
		if os.IsNotExist(err) {
			runtime.LogWarningf(w.ctx, "watch path does not exist: %s (will retry)", w.cfg.Path)
		} else {
			runtime.LogWarningf(w.ctx, "watch path not accessible: %s: %v", w.cfg.Path, err)
		}
	}

	allExisting := w.snapshotExistingStats()
	catchUpFiles := w.filterStatsWithinDays(allExisting)

	// Everything already present when the watcher starts is treated as existing.
	// Only the filtered catch-up subset is converted on startup; the live polling
	// path is reserved for files that appear after startup.
	w.markExistingStatsSeen(allExisting)
	payload := map[string]string{"path": w.cfg.Path}
	runtime.EventsEmit(w.ctx, constants.EventRunsWatcherStarted, payload)

	if len(catchUpFiles) > 0 {
		go w.catchUpExisting(catchUpFiles, currentGen)
	}

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
	w.gen++
	w.stopCh = make(chan struct{})
	return nil
}

// SetOnRunParsed sets the callback for when a run is ingested.
func (w *Watcher) SetOnRunParsed(fn func(models.RunRecord)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.OnRunParsed = fn
}

func (w *Watcher) Clear() {
	w.mu.Lock()
	w.seen = make(map[string]struct{})
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

		w.ingestStatsFile(full, name, ingestOptions{notifyParsed: true, emitEvent: true})
	}
	return nil
}

func (w *Watcher) snapshotExistingStats() []string {
	if strings.TrimSpace(w.cfg.Path) == "" {
		return nil
	}

	entries, err := os.ReadDir(w.cfg.Path)
	if err != nil {
		runtime.LogWarningf(w.ctx, "failed to read watch path for catch-up: %v", err)
		return nil
	}

	files := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !isKovaaksStatsFile(e.Name()) {
			continue
		}
		files = append(files, filepath.Join(w.cfg.Path, e.Name()))
	}
	sort.Slice(files, func(i, j int) bool {
		return existingStatsTimestamp(files[i]) > existingStatsTimestamp(files[j])
	})
	return files
}

func (w *Watcher) filterStatsWithinDays(files []string) []string {
	days := w.cfg.RecentRunsDays
	minCount := w.cfg.RecentRunsMinCount
	if days <= 0 {
		days = constants.DefaultRecentRunsDays
	}
	if minCount <= 0 {
		minCount = constants.DefaultRecentRunsMinCount
	}
	if days <= 0 {
		if minCount > 0 && len(files) > minCount {
			return files[:minCount]
		}
		return files
	}

	cutoff := time.Now().AddDate(0, 0, -days).UnixMilli()
	out := make([]string, 0, len(files))
	for _, full := range files {
		if existingStatsTimestamp(full) >= cutoff {
			out = append(out, full)
		}
	}

	if minCount > 0 && len(out) < minCount {
		want := minCount
		if want > len(files) {
			want = len(files)
		}
		if want > len(out) {
			return files[:want]
		}
	}
	return out
}

func (w *Watcher) markExistingStatsSeen(files []string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, full := range files {
		w.seen[full] = struct{}{}
	}
}

func (w *Watcher) catchUpExisting(files []string, gen uint64) {
	if len(files) == 0 {
		return
	}
	ingested := false
	for _, full := range files {
		if !w.isGenerationCurrent(gen) {
			return
		}
		if w.ingestStatsFile(full, filepath.Base(full), ingestOptions{ignoreSeen: true}) {
			ingested = true
		}
	}

	// Release memory accumulated during bulk conversion.
	goruntime.GC()
	debug.FreeOSMemory()

	if ingested && w.isGenerationCurrent(gen) {
		runtime.EventsEmit(w.ctx, constants.EventRunsAdded, nil)
	}
}

// ingestStatsFile ingests a stats file with behavior controlled by options.
// Catch-up uses ignoreSeen without callbacks/events; live ingestion enables both.
func (w *Watcher) ingestStatsFile(fullPath, name string, options ingestOptions) bool {
	w.mu.RLock()
	_, known := w.seen[fullPath]
	mouse := w.mouse
	onParsed := w.OnRunParsed
	w.mu.RUnlock()
	if known && !options.ignoreSeen {
		return false
	}

	if w.runSvc.Exists(name) {
		w.mu.Lock()
		w.seen[fullPath] = struct{}{}
		w.mu.Unlock()
		return false
	}

	rec, err := w.runSvc.IngestRun(fullPath, mouse)
	if err != nil {
		runtime.LogErrorf(w.ctx, "parse error for %s: %v", fullPath, err)
		return false
	}

	w.mu.Lock()
	w.seen[fullPath] = struct{}{}
	w.mu.Unlock()

	if options.notifyParsed && onParsed != nil {
		onParsed(rec)
	}

	if options.emitEvent {
		runtime.EventsEmit(w.ctx, constants.EventRunsAdded, nil)
	}

	return true
}

func (w *Watcher) isGenerationCurrent(gen uint64) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.gen == gen && w.running
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
	return strings.HasSuffix(lower, " stats"+constants.StatsFileExt)
}

func existingStatsTimestamp(path string) int64 {
	base := filepath.Base(path)
	if info, ok := parseStatsFilenameTimestamp(base); ok {
		return info
	}
	if fi, statErr := os.Stat(path); statErr == nil {
		return fi.ModTime().UnixMilli()
	}
	return 0
}

var statsFilenameRe = regexp.MustCompile(
	`^(?P<name>.+?)\s-\s.*?\s-\s(?P<dt>\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})\sStats` + regexp.QuoteMeta(constants.StatsFileExt) + `$`,
)

func parseStatsFilenameTimestamp(filename string) (int64, bool) {
	candidate := filename
	if strings.HasSuffix(strings.ToLower(candidate), constants.RunFileExt) {
		candidate = strings.TrimSuffix(candidate, constants.RunFileExt) + constants.StatsFileExt
	}
	m := statsFilenameRe.FindStringSubmatch(candidate)
	if m == nil {
		return 0, false
	}
	t, err := time.ParseInLocation("2006.01.02-15.04.05", m[2], time.Local)
	if err != nil {
		return 0, false
	}
	return t.UnixMilli(), true
}

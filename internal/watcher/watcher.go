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

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// Watcher monitors a directory for new stats files and emits events.
type Watcher struct {
	ctx      context.Context
	cfg      models.WatcherConfig
	mu       sync.RWMutex
	running  bool
	gen      uint64
	stopCh   chan struct{}
	seen     map[string]struct{}
	inFlight map[string]struct{}
	mouse    models.MouseTraceProvider
	runSvc   RunStore

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
		ctx:      ctx,
		cfg:      cfg,
		stopCh:   make(chan struct{}),
		seen:     make(map[string]struct{}),
		inFlight: make(map[string]struct{}),
		runSvc:   runSvc,
	}
}

// SetMouseProvider injects a mouse provider to enrich run records.
func (w *Watcher) SetMouseProvider(p models.MouseTraceProvider) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.mouse = p
}

// Start begins the watch loop. It is safe to call once; subsequent calls are a no-op.
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

	// Everything already present when the watcher starts is treated as existing.
	// Only the filtered catch-up subset is converted on startup; the live
	// detection paths (fsnotify or polling) are reserved for files that appear
	// after startup.
	allExisting := w.snapshotExistingStats()
	catchUpFiles := w.filterStatsWithinDays(allExisting)
	w.markExistingStatsSeen(allExisting)
	runtime.EventsEmit(w.ctx, constants.EventRunsWatcherStarted, map[string]string{"path": w.cfg.Path})

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

// SetOnRunParsed sets the callback invoked when a run is ingested.
func (w *Watcher) SetOnRunParsed(fn func(models.RunRecord)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.OnRunParsed = fn
}

func (w *Watcher) Clear() {
	w.mu.Lock()
	w.seen = make(map[string]struct{})
	w.inFlight = make(map[string]struct{})
	w.mu.Unlock()
}

// loop uses fsnotify for instant file detection when available, falling back
// to the configured poll interval.  The two are mutually exclusive — either
// fsnotify works (instant, zero polling) or we poll periodically.
func (w *Watcher) loop() {
	fsw, err := fsnotify.NewWatcher()
	if err == nil {
		if addErr := fsw.Add(w.cfg.Path); addErr == nil {
			runtime.LogInfof(w.ctx, "fsnotify watching: %s", w.cfg.Path)
			defer fsw.Close()
			for {
				select {
				case <-w.stopCh:
					return
				case ev, ok := <-fsw.Events:
					if !ok {
						return
					}
					if ev.Op&(fsnotify.Create|fsnotify.Write) == 0 {
						continue
					}
					name := filepath.Base(ev.Name)
					if !isKovaaksStatsFile(name) {
						continue
					}
					w.ingestStatsFile(ev.Name, name, ingestOptions{notifyParsed: true, emitEvent: true})
				case fswErr, ok := <-fsw.Errors:
					if !ok {
						return
					}
					runtime.LogWarningf(w.ctx, "fsnotify error: %v", fswErr)
				}
			}
		} else {
			runtime.LogWarningf(w.ctx, "fsnotify unavailable for %s: %v; falling back to polling", w.cfg.Path, addErr)
			_ = fsw.Close()
		}
	} else {
		runtime.LogWarningf(w.ctx, "fsnotify initialization failed: %v; falling back to polling", err)
	}

	// Fallback: poll at configured interval
	runtime.LogInfof(w.ctx, "fsnotify unavailable, falling back to %s polling", w.cfg.PollInterval)
	ticker := time.NewTicker(w.cfg.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			if err := w.scanOnce(); err != nil {
				runtime.LogWarningf(w.ctx, "watcher poll scan failed for %s: %v", w.cfg.Path, err)
			}
		}
	}
}

// IsRunning indicates if the watcher loop is active.
func (w *Watcher) IsRunning() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.running
}

// ScanNow triggers an immediate directory scan outside the normal
// fsnotify/poll cadence, without waiting for the next event or tick. Used to
// pick up files written right before the watched process exits (e.g. so a
// run's screen recording can be scheduled for trimming as soon as possible
// after KovaaK's closes, rather than waiting for the next poll interval).
func (w *Watcher) ScanNow() {
	w.mu.RLock()
	running := w.running
	w.mu.RUnlock()
	if !running {
		return
	}
	if err := w.scanOnce(); err != nil {
		runtime.LogWarningf(w.ctx, "watcher immediate scan failed for %s: %v", w.cfg.Path, err)
	}
}

// WaitForIdle waits until any live file ingestions have registered their run
// work. It is used before releasing a stopped screen-capture session so an
// fsnotify handler already parsing a final stats file cannot lose its segments.
// The supplied context bounds shutdown rather than blocking it indefinitely.
func (w *Watcher) WaitForIdle(ctx context.Context) bool {
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		w.mu.RLock()
		idle := len(w.inFlight) == 0
		w.mu.RUnlock()
		if idle {
			return true
		}
		select {
		case <-ctx.Done():
			return false
		case <-ticker.C:
		}
	}
}

// scanOnce lists the directory and ingests any newly discovered stats files.
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

// catchUpNotifyInterval is the number of runs ingested during startup
// catch-up between runs:added events. Emitting periodically instead of only at
// the end lets the history UI populate progressively while a large backlog of
// stats files is converted.
const catchUpNotifyInterval = 25

func (w *Watcher) catchUpExisting(files []string, gen uint64) {
	if len(files) == 0 {
		return
	}
	ingested := 0
	for _, full := range files {
		if !w.isGenerationCurrent(gen) {
			return
		}
		if w.ingestStatsFile(full, filepath.Base(full), ingestOptions{ignoreSeen: true}) {
			ingested++
			if ingested%catchUpNotifyInterval == 0 {
				runtime.EventsEmit(w.ctx, constants.EventRunsAdded, nil)
			}
		}
	}
	goruntime.GC()
	debug.FreeOSMemory()
	// Final event picks up any remainder beyond the last chunk.
	if ingested > 0 && w.isGenerationCurrent(gen) {
		runtime.EventsEmit(w.ctx, constants.EventRunsAdded, nil)
	}
}

// ingestStatsFile ingests a stats file with behavior controlled by options.
// Catch-up uses ignoreSeen without callbacks/events; live ingestion enables both.
func (w *Watcher) ingestStatsFile(fullPath, name string, options ingestOptions) bool {
	// fsnotify, polling, and ScanNow may all discover the same file. Reserve it
	// before parsing so only one path can create a run/replay trim; unlike seen,
	// a failed parse releases the reservation and remains retryable.
	w.mu.Lock()
	_, known := w.seen[fullPath]
	_, processing := w.inFlight[fullPath]
	if processing || (known && !options.ignoreSeen) {
		w.mu.Unlock()
		return false
	}
	w.inFlight[fullPath] = struct{}{}
	mouse := w.mouse
	onParsed := w.OnRunParsed
	w.mu.Unlock()
	defer func() {
		w.mu.Lock()
		delete(w.inFlight, fullPath)
		w.mu.Unlock()
	}()

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

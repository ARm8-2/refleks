package watcher

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/parser"
	"refleks/internal/sens"
	"refleks/internal/traces"
	"refleks/internal/util"
)

// Watcher monitors a directory for new stats files and emits events.
type Watcher struct {
	ctx     context.Context
	cfg     models.WatcherConfig
	mu      sync.RWMutex
	running bool
	stopCh  chan struct{}
	seen    map[string]struct{} // full file path set

	recent    []models.ScenarioRecord
	mouse     MouseProvider
	tracesSvc *traces.Service

	OnScenarioParsed func(models.ScenarioRecord)
}

// New returns a new Watcher with the given config.
func New(ctx context.Context, cfg models.WatcherConfig, tracesSvc *traces.Service) *Watcher {
	return &Watcher{
		ctx:       ctx,
		cfg:       cfg,
		stopCh:    make(chan struct{}),
		seen:      make(map[string]struct{}),
		tracesSvc: tracesSvc,
	}
}

// MouseProvider supplies time-ranged mouse traces for enrichment.
type MouseProvider interface {
	Enabled() bool
	GetRange(start, end time.Time) []models.MousePoint
}

// SetMouseProvider injects a mouse provider to enrich scenario records.
func (w *Watcher) SetMouseProvider(p MouseProvider) {
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

	runtime.EventsEmit(w.ctx, constants.EventWatcherStarted, map[string]string{"path": w.cfg.Path})

	// Optionally parse existing files once
	if w.cfg.ParseExistingOnStart {
		_ = w.scanOnce(true)
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
			_ = w.scanOnce(false)
		}
	}
}

// scanOnce lists directory and emits events for newly discovered files.
func (w *Watcher) scanOnce(includeAll bool) error {
	entries, err := os.ReadDir(w.cfg.Path)
	if err != nil {
		return err
	}
	// Build list with parsed timestamps so we can sort by date, not filename
	type fileRec struct {
		path string
		t    time.Time
	}
	var files []fileRec
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !isKovaaksStatsFile(name) {
			continue
		}
		full := filepath.Join(w.cfg.Path, name)

		// Optimization: If we're not forcing a re-scan, skip files we've already processed.
		// This avoids expensive regex parsing on thousands of files every poll interval.
		if !includeAll {
			w.mu.RLock()
			_, known := w.seen[full]
			w.mu.RUnlock()
			if known {
				continue
			}
		}

		info, err := parser.ParseFilename(name)
		if err != nil {
			continue
		}
		files = append(files, fileRec{path: full, t: info.DatePlayed})
	}
	// Sort by time ascending (oldest first)
	sort.Slice(files, func(i, j int) bool { return files[i].t.Before(files[j].t) })
	// If includeAll with a limit, restrict to last N files
	if includeAll && w.cfg.ParseExistingLimit > 0 && len(files) > w.cfg.ParseExistingLimit {
		// mark older files as seen so we don't parse them later
		older := files[:len(files)-w.cfg.ParseExistingLimit]
		w.mu.Lock()
		for _, fr := range older {
			w.seen[fr.path] = struct{}{}
		}
		w.mu.Unlock()
		// keep only the last N files for parsing now
		files = files[len(files)-w.cfg.ParseExistingLimit:]
	}
	for _, fr := range files {
		full := fr.path
		w.mu.RLock()
		_, known := w.seen[full]
		w.mu.RUnlock()
		if known && !includeAll {
			continue
		}

		rec, err := w.parseFile(full)
		if err != nil {
			runtime.LogErrorf(w.ctx, "parse error for %s: %v", full, err)
			continue
		}

		w.mu.Lock()
		w.seen[full] = struct{}{}
		w.recent = append(w.recent, rec)
		cap := w.effectiveRecentCap()
		if cap > 0 && len(w.recent) > cap {
			w.recent = w.recent[len(w.recent)-cap:]
		}
		w.mu.Unlock()

		if w.OnScenarioParsed != nil {
			w.OnScenarioParsed(rec)
		}

		// Emit a flat ScenarioRecord to simplify the IPC contract.
		runtime.EventsEmit(w.ctx, constants.EventScenarioAdded, rec)
	}
	return nil
}

func (w *Watcher) parseFile(fullPath string) (models.ScenarioRecord, error) {
	info, err := parser.ParseFilename(filepath.Base(fullPath))
	if err != nil {
		return models.ScenarioRecord{}, err
	}
	events, stats, err := parser.ParseStatsFile(fullPath)
	if err != nil {
		return models.ScenarioRecord{}, err
	}

	// Augment stats with derived fields
	stats["Date Played"] = info.DatePlayed.Format(time.RFC3339)
	// Accuracy = Hit Count / (Hit Count + Miss Count)
	var hit, miss float64
	if v, ok := stats["Hit Count"]; ok {
		hit = util.ToFloat(v)
	}
	if v, ok := stats["Miss Count"]; ok {
		miss = util.ToFloat(v)
	}
	denom := hit + miss
	if denom > 0 {
		stats["Accuracy"] = hit / denom
	} else {
		stats["Accuracy"] = 0.0
	}

	// Real Avg TTK = average time between consecutive kill events (in seconds)
	if len(events) >= 2 {
		var times []time.Time
		for _, row := range events {
			if len(row) < 2 {
				continue
			}
			if t, ok := parseTODOnDate(row[1], info.DatePlayed); ok {
				times = append(times, t)
			}
		}
		if len(times) >= 2 {
			var sum time.Duration
			for i := 1; i < len(times); i++ {
				dt := times[i].Sub(times[i-1])
				if dt > 0 {
					sum += dt
				}
			}
			intervals := len(times) - 1
			if intervals > 0 {
				stats["Real Avg TTK"] = sum.Seconds() / float64(intervals)
			}
		}
	}

	// Sensitivity normalized to cm/360 for filtering and charts. Always set; 0 means unsupported.
	if cm, _ := sens.Cm360FromStats(stats); true {
		stats["cm/360"] = cm
	}

	// Calculate duration
	start, end := deriveScenarioWindow(info.DatePlayed, stats, events)
	if !start.IsZero() && !end.IsZero() {
		duration := end.Sub(start).Seconds()
		stats["Duration"] = duration
	}

	rec := models.ScenarioRecord{
		FilePath: fullPath,
		FileName: filepath.Base(fullPath),
		Stats:    stats,
		Events:   events,
	}

	// Optionally enrich with mouse trace based on Challenge Start -> DatePlayed interval
	w.mu.RLock()
	mp := w.mouse
	w.mu.RUnlock()
	if mp != nil && mp.Enabled() {
		start, end := deriveScenarioWindow(info.DatePlayed, stats, events)
		if !start.IsZero() && !end.IsZero() && start.Before(end) {
			rec.MouseTrace = mp.GetRange(start, end)
			// debug
			runtime.LogDebugf(w.ctx, "MouseTrace: %d points for %s in window %s - %s", len(rec.MouseTrace), rec.FileName, start.Format(time.RFC3339), end.Format(time.RFC3339))
		}
	}

	// If we captured a trace, persist it to disk for future reloads.
	if len(rec.MouseTrace) > 0 {
		// Only write if not already present to avoid churn.
		if !w.tracesSvc.Exists(rec.FileName) {
			_ = w.tracesSvc.Save(traces.ScenarioData{
				Version:      1,
				FileName:     rec.FileName,
				ScenarioName: info.ScenarioName,
				DatePlayed:   info.DatePlayed.Format(time.RFC3339),
				MouseTrace:   rec.MouseTrace,
			})
		}
		// We have a trace, but we don't send it immediately to save bandwidth/memory.
		// The frontend will request it if needed.
		rec.HasTrace = true
		rec.MouseTrace = nil
	} else {
		// No live capture available (e.g., after restart). Check if persisted data exists.
		if w.tracesSvc.Exists(rec.FileName) {
			rec.HasTrace = true
		}
	}
	return rec, nil
}

// deriveScenarioWindow attempts to compute the [start, end] timespan of a scenario.
// end is taken from the filename timestamp (DatePlayed). Start prefers the
// "Challenge Start" key in stats, falling back to the first event timestamp.
func deriveScenarioWindow(end time.Time, stats map[string]any, events [][]string) (time.Time, time.Time) {
	// Try stats["Challenge Start"] first
	var start time.Time
	if v, ok := stats["Challenge Start"]; ok {
		if s, ok := v.(string); ok {
			if t, ok := parseTODOnDate(s, end); ok {
				start = t
			}
		}
	}
	// Do NOT use "Fight Time" directly: its units vary and often represent active time, not total duration.
	// Fallback to the first event timestamp's time-of-day
	if start.IsZero() && len(events) > 0 && len(events[0]) > 1 {
		ts := events[0][1]
		if t, ok := parseTODOnDate(ts, end); ok {
			start = t
		}
	}
	// Final fallback: assume a 60s scenario
	if start.IsZero() {
		start = end.Add(-60 * time.Second)
	}
	// If start ended up after end (e.g., crossed midnight), shift by -1 day
	if start.After(end) {
		start = start.AddDate(0, 0, -1)
	}
	return start, end
}

// parseTODOnDate parses a clock time string onto the provided date.
func parseTODOnDate(s string, date time.Time) (time.Time, bool) {
	// Support common formats with/without fractional seconds
	layouts := []string{
		"15:04:05.000000",
		"15:04:05.000",
		"15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return time.Date(date.Year(), date.Month(), date.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), date.Location()), true
		}
	}
	return time.Time{}, false
}

// removed duplicate toFloat: use util.ToFloat instead

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

// ReloadTraces checks for persisted mouse traces for recent scenarios.
// If a record didn't have a trace but now does, a 'ScenarioUpdated' event is emitted.
func (w *Watcher) ReloadTraces() int {
	// Copy updated records to emit outside the lock
	var toEmit []models.ScenarioRecord
	w.mu.Lock()
	for i := range w.recent {
		rec := w.recent[i]
		// Check if trace exists on disk
		if !rec.HasTrace && w.tracesSvc.Exists(rec.FileName) {
			rec.HasTrace = true
			w.recent[i] = rec
			toEmit = append(toEmit, rec)
		}
	}
	w.mu.Unlock()

	for _, rec := range toEmit {
		runtime.EventsEmit(w.ctx, constants.EventScenarioUpdated, rec)
	}
	return len(toEmit)
}

// isKovaaksStatsFile reports whether a filename looks like a Kovaak's exported stats csv.
func isKovaaksStatsFile(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, " stats.csv")
}

// effectiveRecentCap returns the in-memory cap for recent scenarios.
// If ParseExistingLimit is zero (parse all), we still bound memory to a sensible default.
func (w *Watcher) effectiveRecentCap() int {
	cap := w.cfg.ParseExistingLimit
	if cap <= 0 {
		cap = constants.DefaultRecentCap
	}
	return cap
}

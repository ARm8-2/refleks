package watcher

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"refleks/internal/models"
)

type fakeRunStore struct {
	mu          sync.Mutex
	existing    map[string]bool
	ingestCalls []string
	lastMouse   models.MouseTraceProvider
	record      models.RunRecord
}

func (f *fakeRunStore) Exists(name string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.existing[name]
}

func (f *fakeRunStore) IngestRun(path string, mouse models.MouseTraceProvider) (models.RunRecord, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ingestCalls = append(f.ingestCalls, path)
	f.lastMouse = mouse
	return f.record, nil
}

func (f *fakeRunStore) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.ingestCalls)
}

type stubMouse struct{}

func (stubMouse) Enabled() bool                                     { return true }
func (stubMouse) GetRange(time.Time, time.Time) []models.MousePoint { return nil }
func (stubMouse) GetRunMetadata(time.Time, time.Time) models.MouseRunMetadata {
	return models.MouseRunMetadata{}
}

func (w *Watcher) hasSeen(path string) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	_, ok := w.seen[path]
	return ok
}

func TestIsKovaaksStatsFile(t *testing.T) {
	tests := map[string]bool{
		"Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv":     true,
		"Scenario - Challenge - 2026.01.02-03.04.05 stats.CSV":     true,
		"Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv.tmp": false,
		"Scenario - Challenge - 2026.01.02-03.04.05.refleks":       false,
		"notes.csv": false, // not a Kovaak's stats export
		"":          false,
	}
	for name, want := range tests {
		if got := isKovaaksStatsFile(name); got != want {
			t.Errorf("isKovaaksStatsFile(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestParseStatsFilenameTimestamp(t *testing.T) {
	want := time.Date(2026, 1, 2, 3, 4, 5, 0, time.Local).UnixMilli()

	if got, ok := parseStatsFilenameTimestamp("Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv"); !ok || got != want {
		t.Errorf("stats name = (%d, %v), want (%d, true)", got, ok, want)
	}
	if got, ok := parseStatsFilenameTimestamp("Scenario - Challenge - 2026.01.02-03.04.05 Stats.refleks"); !ok || got != want {
		t.Errorf("run name = (%d, %v), want (%d, true)", got, ok, want)
	}
	if _, ok := parseStatsFilenameTimestamp("not a stats file.csv"); ok {
		t.Error("unrecognized name should not produce a timestamp")
	}
}

func TestExistingStatsTimestamp(t *testing.T) {
	name := "Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv"
	want := time.Date(2026, 1, 2, 3, 4, 5, 0, time.Local).UnixMilli()
	if got := existingStatsTimestamp(filepath.Join(t.TempDir(), name)); got != want {
		t.Errorf("timestamp from name = %d, want %d", got, want)
	}

	// An unrecognizable name falls back to the file modification time.
	path := filepath.Join(t.TempDir(), "opaque.csv")
	if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	mod := time.Date(2025, 6, 7, 8, 9, 10, 0, time.Local)
	if err := os.Chtimes(path, mod, mod); err != nil {
		t.Fatal(err)
	}
	if got := existingStatsTimestamp(path); got != mod.UnixMilli() {
		t.Errorf("timestamp from mtime = %d, want %d", got, mod.UnixMilli())
	}

	// A missing file with an unrecognizable name yields zero.
	if got := existingStatsTimestamp(filepath.Join(t.TempDir(), "missing.csv")); got != 0 {
		t.Errorf("missing file timestamp = %d, want 0", got)
	}
}

func TestSnapshotExistingStats(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	recent := statsFileName("Recent", now.AddDate(0, 0, -1))
	older := statsFileName("Older", now.AddDate(0, 0, -10))

	for _, name := range []string{recent, older, "notes.csv"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(dir, "nested"), 0o755); err != nil {
		t.Fatal(err)
	}

	w := New(context.Background(), models.WatcherConfig{Path: dir}, nil)
	got := w.snapshotExistingStats()
	if len(got) != 2 {
		t.Fatalf("files = %v, want only the two stats files", got)
	}
	// Sorted newest first.
	if filepath.Base(got[0]) != recent || filepath.Base(got[1]) != older {
		t.Fatalf("order = %v, want [recent older]", got)
	}

	if empty := New(context.Background(), models.WatcherConfig{}, nil).snapshotExistingStats(); empty != nil {
		t.Errorf("empty path snapshot = %v, want nil", empty)
	}
}

func TestFilterStatsWithinDays(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	recent := filepath.Join(dir, statsFileName("Recent", now.AddDate(0, 0, -1)))
	old := filepath.Join(dir, statsFileName("Old", now.AddDate(0, 0, -10)))
	files := []string{recent, old}

	w := New(context.Background(), models.WatcherConfig{RecentRunsDays: 7, RecentRunsMinCount: 1}, nil)
	if got := w.filterStatsWithinDays(files); len(got) != 1 || got[0] != recent {
		t.Fatalf("filtered = %v, want only the recent file", got)
	}

	// The min-count floor reinstates files older than the cutoff.
	w.cfg.RecentRunsMinCount = 2
	if got := w.filterStatsWithinDays(files); len(got) != 2 {
		t.Fatalf("filtered = %v, want both via min-count", got)
	}

	// A non-positive day window falls back to the default recent window.
	w.cfg.RecentRunsDays = 0
	w.cfg.RecentRunsMinCount = 0
	if got := w.filterStatsWithinDays(files); len(got) != 2 {
		t.Fatalf("default window filtered = %v, want both", got)
	}
}

func TestIngestStatsFileSuccess(t *testing.T) {
	store := &fakeRunStore{existing: map[string]bool{}, record: models.RunRecord{FileName: "parsed"}}
	w := New(context.Background(), models.WatcherConfig{}, store)

	mouse := stubMouse{}
	w.SetMouseProvider(mouse)
	var parsed *models.RunRecord
	w.SetOnRunParsed(func(r models.RunRecord) { parsed = &r })

	path := filepath.Join(t.TempDir(), "Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv")
	if !w.ingestStatsFile(path, filepath.Base(path), ingestOptions{notifyParsed: true}) {
		t.Fatal("ingestStatsFile = false, want true")
	}

	if parsed == nil || parsed.FileName != "parsed" {
		t.Fatalf("OnRunParsed record = %v", parsed)
	}
	if store.lastMouse != models.MouseTraceProvider(mouse) {
		t.Error("mouse provider was not passed to IngestRun")
	}
	if !w.hasSeen(path) {
		t.Error("ingested file should be marked seen")
	}
}

func TestIngestStatsFileSkipsKnownAndExisting(t *testing.T) {
	name := "Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv"
	dir := t.TempDir()
	path := filepath.Join(dir, name)

	t.Run("already seen", func(t *testing.T) {
		store := &fakeRunStore{existing: map[string]bool{}}
		w := New(context.Background(), models.WatcherConfig{}, store)

		if !w.ingestStatsFile(path, name, ingestOptions{}) {
			t.Fatal("first ingest should succeed")
		}
		if w.ingestStatsFile(path, name, ingestOptions{}) {
			t.Fatal("second ingest of a seen file should be skipped")
		}
		if store.callCount() != 1 {
			t.Fatalf("IngestRun calls = %d, want 1", store.callCount())
		}
	})

	t.Run("ignoreSeen reprocesses", func(t *testing.T) {
		store := &fakeRunStore{existing: map[string]bool{}}
		w := New(context.Background(), models.WatcherConfig{}, store)

		w.ingestStatsFile(path, name, ingestOptions{})
		if !w.ingestStatsFile(path, name, ingestOptions{ignoreSeen: true}) {
			t.Fatal("ignoreSeen should reprocess a seen file")
		}
		if store.callCount() != 2 {
			t.Fatalf("IngestRun calls = %d, want 2", store.callCount())
		}
	})

	t.Run("store already has it", func(t *testing.T) {
		store := &fakeRunStore{existing: map[string]bool{name: true}}
		w := New(context.Background(), models.WatcherConfig{}, store)

		if w.ingestStatsFile(path, name, ingestOptions{}) {
			t.Fatal("existing run should not be re-ingested")
		}
		if store.callCount() != 0 {
			t.Fatalf("IngestRun calls = %d, want 0", store.callCount())
		}
		if !w.hasSeen(path) {
			t.Error("existing file should be marked seen")
		}
	})
}

func TestUpdateConfig(t *testing.T) {
	w := New(context.Background(), models.WatcherConfig{Path: "a"}, nil)

	if err := w.UpdateConfig(models.WatcherConfig{Path: "b"}); err != nil {
		t.Fatalf("UpdateConfig while stopped: %v", err)
	}
	if w.cfg.Path != "b" {
		t.Fatalf("cfg.Path = %q, want b", w.cfg.Path)
	}

	// Simulate a running watcher; config changes are rejected.
	w.mu.Lock()
	w.running = true
	w.mu.Unlock()
	if err := w.UpdateConfig(models.WatcherConfig{Path: "c"}); err == nil {
		t.Fatal("UpdateConfig while running should fail")
	}
}

func TestClearAndIdleState(t *testing.T) {
	w := New(context.Background(), models.WatcherConfig{}, nil)
	if w.IsRunning() {
		t.Fatal("new watcher should not be running")
	}

	w.mu.Lock()
	w.seen["x"] = struct{}{}
	w.inFlight["y"] = struct{}{}
	w.mu.Unlock()

	w.Clear()
	if w.hasSeen("x") {
		t.Error("Clear should reset seen")
	}
	w.mu.RLock()
	inFlight := len(w.inFlight)
	w.mu.RUnlock()
	if inFlight != 0 {
		t.Error("Clear should reset inFlight")
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if !w.WaitForIdle(ctx) {
		t.Error("WaitForIdle should return true when nothing is in flight")
	}
}

func statsFileName(scenario string, at time.Time) string {
	return scenario + " - Challenge - " + at.Format("2006.01.02-15.04.05") + " Stats.csv"
}

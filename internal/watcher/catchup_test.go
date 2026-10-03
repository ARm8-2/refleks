package watcher

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"refleks/internal/models"
)

type watcherRunStoreFuncs struct {
	exists func(string) bool
	ingest func(string, models.MouseTraceProvider) (models.RunRecord, error)
}

func (s watcherRunStoreFuncs) Exists(name string) bool {
	return s.exists != nil && s.exists(name)
}

func (s watcherRunStoreFuncs) IngestRun(path string, mouse models.MouseTraceProvider) (models.RunRecord, error) {
	return s.ingest(path, mouse)
}

func setWatcherTestGeneration(w *Watcher, gen uint64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.running = true
	w.gen = gen
}

func assertWatcherIdle(t *testing.T, w *Watcher) {
	t.Helper()
	w.mu.RLock()
	defer w.mu.RUnlock()
	if len(w.inFlight) != 0 {
		t.Errorf("unreleased reservations = %v", w.inFlight)
	}
}

func waitWatcherTestSignal(t *testing.T, signal <-chan struct{}, description string) bool {
	t.Helper()
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()
	select {
	case <-signal:
		return true
	case <-timer.C:
		t.Errorf("timed out waiting for %s", description)
		return false
	}
}

// Always release and join, including when a test fails before its normal release.
func runBlockedWatcherWork(t *testing.T, work func(<-chan struct{})) (func(), <-chan struct{}) {
	t.Helper()
	released := make(chan struct{})
	done := make(chan struct{})
	var once sync.Once
	release := func() { once.Do(func() { close(released) }) }
	t.Cleanup(func() {
		release()
		waitWatcherTestSignal(t, done, "worker cleanup")
	})
	go func() {
		defer close(done)
		work(released)
	}()
	return release, done
}

func TestCatchUpExistingInactiveOrEmpty(t *testing.T) {
	for _, mode := range []string{"empty", "stopped", "stale generation"} {
		t.Run(mode, func(t *testing.T) {
			store := watcherRunStoreFuncs{
				exists: func(string) bool { t.Error("inactive catch-up checked the store"); return false },
				ingest: func(string, models.MouseTraceProvider) (models.RunRecord, error) {
					t.Error("inactive catch-up ingested a file")
					return models.RunRecord{}, nil
				},
			}
			w := New(context.Background(), models.WatcherConfig{}, store)
			files := []string{filepath.Join(t.TempDir(), "Run Stats.csv")}
			switch mode {
			case "empty":
				setWatcherTestGeneration(w, 1)
				files = nil
			case "stale generation":
				setWatcherTestGeneration(w, 2)
			}
			w.catchUpExisting(files, 1)
			assertWatcherIdle(t, w)
		})
	}
}

func TestCatchUpStopsAfterGenerationChanges(t *testing.T) {
	for _, mode := range []string{"stop", "replace"} {
		t.Run(mode, func(t *testing.T) {
			dir := t.TempDir()
			files := []string{
				filepath.Join(dir, "Run 1 Stats.csv"),
				filepath.Join(dir, "Run 2 Stats.csv"),
			}
			started := make(chan struct{})
			var attempted []string
			var releaseIngest <-chan struct{}
			store := watcherRunStoreFuncs{
				ingest: func(path string, _ models.MouseTraceProvider) (models.RunRecord, error) {
					attempted = append(attempted, path)
					close(started)
					<-releaseIngest
					return models.RunRecord{FileName: filepath.Base(path)}, nil
				},
			}
			w := New(context.Background(), models.WatcherConfig{}, store)
			setWatcherTestGeneration(w, 10)
			release, done := runBlockedWatcherWork(t, func(released <-chan struct{}) {
				releaseIngest = released
				w.catchUpExisting(files, 10)
			})
			if !waitWatcherTestSignal(t, started, "blocked catch-up ingestion") {
				t.FailNow()
			}
			if mode == "stop" {
				if err := w.Stop(); err != nil {
					t.Fatal(err)
				}
			} else {
				setWatcherTestGeneration(w, 11)
			}
			release()
			if !waitWatcherTestSignal(t, done, "cancelled catch-up completion") {
				t.FailNow()
			}
			if !reflect.DeepEqual(attempted, files[:1]) {
				t.Errorf("ingested = %v, want only %v", attempted, files[:1])
			}
			if !w.hasSeen(files[0]) || w.hasSeen(files[1]) {
				t.Error("catch-up should finish the current file but skip the remaining files")
			}
			assertWatcherIdle(t, w)
		})
	}
}

func TestScanOnceReturnsFilesystemErrors(t *testing.T) {
	for _, mode := range []string{"missing directory", "regular file", "empty path"} {
		t.Run(mode, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "watch path")
			if mode == "regular file" {
				if err := os.WriteFile(path, []byte("not a directory"), 0o600); err != nil {
					t.Fatal(err)
				}
			} else if mode == "empty path" {
				path = ""
			}
			w := New(context.Background(), models.WatcherConfig{Path: path}, watcherRunStoreFuncs{})
			err := w.scanOnce()
			if mode == "empty path" {
				if err != nil {
					t.Fatalf("scanOnce with empty path = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatal("scanOnce should return an error for an inaccessible path")
			}
			if mode == "missing directory" && !errors.Is(err, os.ErrNotExist) {
				t.Errorf("missing directory error = %v, want os.ErrNotExist", err)
			}
		})
	}
}

func TestUpdateConfigRequiresStoppedWatcher(t *testing.T) {
	w := New(context.Background(), models.WatcherConfig{Path: "before"}, watcherRunStoreFuncs{})
	updated := models.WatcherConfig{Path: "after"}
	if err := w.UpdateConfig(updated); err != nil {
		t.Fatalf("UpdateConfig while stopped: %v", err)
	}
	if w.cfg.Path != updated.Path {
		t.Fatalf("config path = %q, want %q", w.cfg.Path, updated.Path)
	}
	setWatcherTestGeneration(w, 1)
	if err := w.UpdateConfig(models.WatcherConfig{Path: "rejected"}); err == nil {
		t.Fatal("UpdateConfig while running should return an error")
	}
	if w.cfg.Path != updated.Path {
		t.Fatalf("running watcher config changed to %q", w.cfg.Path)
	}
}

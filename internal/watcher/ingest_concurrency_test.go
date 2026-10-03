package watcher

import (
	"context"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"refleks/internal/models"
)

type blockingRunStore struct {
	started chan struct{}
	release chan struct{}
	once    sync.Once
	calls   atomic.Int32
}

func (*blockingRunStore) Exists(string) bool { return false }

func (s *blockingRunStore) IngestRun(string, models.MouseTraceProvider) (models.RunRecord, error) {
	s.calls.Add(1)
	s.once.Do(func() { close(s.started) })
	<-s.release
	return models.RunRecord{FileName: "parsed"}, nil
}

func TestConcurrentIngestionReservesFileUntilCallbackCompletes(t *testing.T) {
	store := &blockingRunStore{started: make(chan struct{}), release: make(chan struct{})}
	w := New(context.Background(), models.WatcherConfig{}, store)
	var callbacks atomic.Int32
	w.SetOnRunParsed(func(rec models.RunRecord) {
		if rec.FileName != "parsed" {
			t.Errorf("callback record = %+v", rec)
		}
		w.mu.RLock()
		pending := len(w.inFlight)
		w.mu.RUnlock()
		if pending != 1 {
			t.Errorf("in-flight reservations during callback = %d, want 1", pending)
		}
		callbacks.Add(1)
	})
	name := "Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv"
	path := filepath.Join(t.TempDir(), name)
	completed := make(chan bool, 1)
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(store.release) }) }
	defer release()
	go func() {
		completed <- w.ingestStatsFile(path, name, ingestOptions{notifyParsed: true})
	}()
	select {
	case <-store.started:
	case <-time.After(3 * time.Second):
		t.Fatal("ingestion did not start")
	}

	for _, options := range []ingestOptions{{}, {ignoreSeen: true}} {
		if w.ingestStatsFile(path, name, options) {
			t.Error("concurrent ingestion should not bypass the reservation")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if w.WaitForIdle(ctx) {
		t.Error("WaitForIdle should report cancellation while parsing is blocked")
	}
	release()
	select {
	case ok := <-completed:
		if !ok {
			t.Error("reserved ingestion failed")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("ingestion did not complete")
	}
	if !w.WaitForIdle(ctx) || !w.hasSeen(path) {
		t.Error("successful ingestion should mark the file seen and release its reservation")
	}
	if store.calls.Load() != 1 || callbacks.Load() != 1 {
		t.Errorf("ingestions = %d, callbacks = %d; want one each", store.calls.Load(), callbacks.Load())
	}
}

package benchmarks

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/settings"
)

type progressRoundTripFunc func(*http.Request) (*http.Response, error)

func (f progressRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func progressResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func newProgressTestService(t *testing.T, transport progressRoundTripFunc) *Service {
	t.Helper()
	cacheSvc := isolatedBenchmarkCache(t)
	t.Setenv(constants.EnvSteamInstallDirVar, t.TempDir())
	t.Setenv(constants.EnvKovaaksInstallDirVar, t.TempDir())
	t.Setenv(constants.EnvSteamIDVar, "test-steam-id")
	t.Setenv(constants.EnvPersonaNameVar, "test-player")
	s := NewService(settings.NewService(), cacheSvc)
	s.httpClient = &http.Client{Transport: transport}
	s.progressRequestDelay = 0
	// Keep this test independent of the catalog API and rank calculations.
	s.benchmarksList = []models.Benchmark{{BenchmarkName: "Unrelated benchmark"}}
	return s
}

func waitForProgressRequestRemoved(t *testing.T, s *Service) {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		s.mu.Lock()
		pending := len(s.progressRequests)
		s.mu.Unlock()
		if pending == 0 {
			return
		}
		select {
		case <-deadline:
			t.Fatal("completed progress request was not removed")
		case <-time.After(time.Millisecond):
		}
	}
}

func TestProgressRefreshDeduplicatesQueuedRequest(t *testing.T) {
	started := make(chan struct{})
	releaseResponse := make(chan struct{})
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(releaseResponse) }) }
	defer release()

	var requests atomic.Int32
	var startOnce sync.Once
	s := newProgressTestService(t, func(req *http.Request) (*http.Response, error) {
		if got := req.URL.Query().Get("benchmarkId"); got != "42" {
			t.Errorf("benchmarkId = %q, want 42", got)
		}
		if got := req.URL.Query().Get("steamId"); got != "test-steam-id" {
			t.Errorf("steamId = %q, want test-steam-id", got)
		}
		requests.Add(1)
		startOnce.Do(func() { close(started) })
		<-releaseResponse
		return progressResponse(`{"overall_rank":2,"benchmark_progress":31}`), nil
	})
	var updates atomic.Int32
	s.SetOnProgressUpdated(func(id int, progress models.BenchmarkProgress) {
		if id != 42 || progress.OverallRank != 2 {
			t.Errorf("updated progress = %d, %+v", id, progress)
		}
		updates.Add(1)
	})

	type result struct {
		progress models.BenchmarkProgress
		cached   bool
		err      error
	}
	resultCh := make(chan result, 1)
	go func() {
		progress, cached, err := s.GetBenchmarkProgress(42, false)
		resultCh <- result{progress, cached, err}
	}()

	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("progress request did not start")
	}
	s.QueueBenchmarkProgressRefresh(42)
	s.QueueBenchmarkProgressRefresh(42)
	release()

	select {
	case got := <-resultCh:
		if got.err != nil || got.cached || got.progress.OverallRank != 2 || got.progress.BenchmarkProgress != 31 {
			t.Errorf("GetBenchmarkProgress = %+v", got)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("progress request did not complete")
	}
	cached, fromCache, err := s.GetBenchmarkProgress(42, true)
	if err != nil || !fromCache || cached.OverallRank != 2 {
		t.Errorf("cached GetBenchmarkProgress = %+v, %v, %v", cached, fromCache, err)
	}
	if requests.Load() != 1 || updates.Load() != 1 {
		t.Errorf("requests = %d, updates = %d, want one each", requests.Load(), updates.Load())
	}

	waitForProgressRequestRemoved(t, s)
}

func TestProgressRefreshRetriesAfterInvalidResponse(t *testing.T) {
	var requests atomic.Int32
	s := newProgressTestService(t, func(_ *http.Request) (*http.Response, error) {
		if requests.Add(1) == 1 {
			return progressResponse("{invalid json"), nil
		}
		return progressResponse(`{"overall_rank":3}`), nil
	})

	if _, _, err := s.GetBenchmarkProgress(42, false); err == nil {
		t.Fatal("expected invalid progress to fail")
	}
	waitForProgressRequestRemoved(t, s)
	progress, cached, err := s.GetBenchmarkProgress(42, false)
	if err != nil || cached || progress.OverallRank != 3 {
		t.Fatalf("second GetBenchmarkProgress = %+v, %v, %v", progress, cached, err)
	}
	if got := requests.Load(); got != 2 {
		t.Errorf("request count = %d, want 2", got)
	}
}

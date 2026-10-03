package benchmarks

import (
	"errors"
	"net/http"
	"testing"

	"refleks/internal/cache"
	"refleks/internal/constants"
	"refleks/internal/models"
)

func isolatedBenchmarkCache(t *testing.T) *cache.Service {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	return cache.NewService()
}

func TestSyncBenchmarksCacheNotModified(t *testing.T) {
	cacheSvc := isolatedBenchmarkCache(t)
	cached := benchmarksCachePayload{
		Benchmarks: []models.Benchmark{{BenchmarkName: "Cached benchmark"}},
		Count:      1,
		ETag:       `W/"cached"`,
	}
	if err := cacheSvc.Save(constants.BenchmarksDataCacheFileName, cached); err != nil {
		t.Fatal(err)
	}

	requests := 0
	s := newBenchService(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		if got := r.Header.Get("If-None-Match"); got != cached.ETag {
			t.Errorf("If-None-Match = %q, want %q", got, cached.ETag)
		}
		w.WriteHeader(http.StatusNotModified)
	})
	s.cacheSvc = cacheSvc
	updates := 0
	s.SetOnBenchmarksUpdated(func(items []models.Benchmark) {
		updates++
		if len(items) != 1 || items[0].BenchmarkName != "Cached benchmark" {
			t.Errorf("updated benchmarks = %+v", items)
		}
	})

	if err := s.SyncBenchmarksCache(); err != nil {
		t.Fatalf("SyncBenchmarksCache: %v", err)
	}
	if requests != 1 || updates != 1 {
		t.Errorf("requests = %d, updates = %d, want one each", requests, updates)
	}
	list, err := s.GetBenchmarks()
	if err != nil || len(list) != 1 || list[0].BenchmarkName != "Cached benchmark" {
		t.Fatalf("GetBenchmarks = %+v, %v", list, err)
	}
	var persisted benchmarksCachePayload
	if err := cacheSvc.Load(constants.BenchmarksDataCacheFileName, &persisted); err != nil {
		t.Fatal(err)
	}
	if persisted.ETag != cached.ETag || persisted.Benchmarks[0].BenchmarkName != "Cached benchmark" {
		t.Errorf("persisted cache changed: %+v", persisted)
	}
}

func TestSyncBenchmarksCacheNotModifiedWithoutCache(t *testing.T) {
	cacheSvc := isolatedBenchmarkCache(t)
	s := newBenchService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotModified)
	})
	s.cacheSvc = cacheSvc

	if err := s.SyncBenchmarksCache(); !errors.Is(err, errBenchmarksCacheMissing) {
		t.Fatalf("SyncBenchmarksCache error = %v, want errBenchmarksCacheMissing", err)
	}
	if cacheSvc.Exists(constants.BenchmarksDataCacheFileName) {
		t.Error("unexpected cache file after 304 without cached data")
	}
}

func TestSyncBenchmarksCacheFallsBackWhenAPIFails(t *testing.T) {
	cacheSvc := isolatedBenchmarkCache(t)
	s := newBenchService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	s.cacheSvc = cacheSvc

	if err := s.SyncBenchmarksCache(); err != nil {
		t.Fatalf("SyncBenchmarksCache: %v", err)
	}
	list, err := s.GetBenchmarks()
	if err != nil || len(list) == 0 {
		t.Fatalf("GetBenchmarks after fallback = %d items, %v", len(list), err)
	}
	var persisted benchmarksCachePayload
	if err := cacheSvc.Load(constants.BenchmarksDataCacheFileName, &persisted); err != nil {
		t.Fatalf("fallback not saved: %v", err)
	}
	if len(persisted.Benchmarks) != len(list) || persisted.Count != len(list) {
		t.Errorf("persisted fallback has %d items (count %d), want %d", len(persisted.Benchmarks), persisted.Count, len(list))
	}
}

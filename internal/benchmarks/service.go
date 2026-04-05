package benchmarks

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"refleks/internal/cache"
	"refleks/internal/models"
	"refleks/internal/settings"
)

// Service manages benchmark data and progress tracking.
type Service struct {
	mu                sync.Mutex
	progressCache     map[int]models.BenchmarkProgress
	scenarioIndex     map[string][]int
	benchmarksList    []models.Benchmark
	loadErr           error
	benchmarksURL     string
	httpClient        *http.Client
	onProgressUpdated func(int, models.BenchmarkProgress)
	settingsSvc       *settings.Service
	cacheSvc          *cache.Service
}

// NewService creates a new benchmark service.
func NewService(settingsSvc *settings.Service, cacheSvc *cache.Service) *Service {
	s := &Service{
		progressCache: make(map[int]models.BenchmarkProgress),
		scenarioIndex: make(map[string][]int),
		benchmarksURL: resolveBenchmarksEndpoint(),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		settingsSvc: settingsSvc,
		cacheSvc:    cacheSvc,
	}
	// Register cache clear callback
	cacheSvc.RegisterOnClear(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.progressCache = make(map[int]models.BenchmarkProgress)
		s.scenarioIndex = make(map[string][]int)
		s.benchmarksList = nil
		s.loadErr = nil
	})
	return s
}

// SetOnProgressUpdated sets the callback for when progress is updated.
func (s *Service) SetOnProgressUpdated(cb func(int, models.BenchmarkProgress)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onProgressUpdated = cb
}

// GetBenchmarkProgress returns progress for a specific benchmark.
func (s *Service) GetBenchmarkProgress(benchmarkId int, useCache bool) (models.BenchmarkProgress, bool, error) {
	if useCache {
		if p, ok := s.GetCachedBenchmarkProgress(benchmarkId); ok {
			return p, true, nil
		}
	}

	raw, err := s.GetPlayerProgressRaw(benchmarkId)
	if err != nil {
		return models.BenchmarkProgress{}, false, err
	}
	prog, err := s.buildStructuredProgress(raw, benchmarkId)
	if err != nil {
		return models.BenchmarkProgress{}, false, err
	}

	// Update cache asynchronously
	go func(bid int, p models.BenchmarkProgress) {
		s.mu.Lock()
		defer s.mu.Unlock()

		// Ensure cache is loaded
		if len(s.progressCache) == 0 {
			// Try to load, if fails, make new map
			if _, err := s.loadCacheLocked(); err != nil {
				// ignore error, start fresh
			}
		}

		s.progressCache[bid] = p
		_ = s.saveCacheLocked()

		if s.onProgressUpdated != nil {
			s.onProgressUpdated(bid, p)
		}
	}(benchmarkId, prog)

	return prog, false, nil
}

// GetAllBenchmarkProgresses returns progress for all benchmarks.
func (s *Service) GetAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	list, err := s.GetBenchmarks()
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	// Ensure cache is loaded
	if len(s.progressCache) == 0 {
		_, _ = s.loadCacheLocked()
	}

	// Build set of valid IDs
	validIDs := make(map[int]struct{})
	for _, b := range list {
		for _, d := range b.Difficulties {
			validIDs[d.KovaaksBenchmarkID] = struct{}{}
		}
	}

	// Prune obsolete entries from cache
	pruned := false
	for id := range s.progressCache {
		if _, ok := validIDs[id]; !ok {
			delete(s.progressCache, id)
			pruned = true
		}
	}
	if pruned {
		_ = s.saveCacheLocked()
	}

	// Create a copy to return and identify missing IDs
	result := make(map[int]models.BenchmarkProgress, len(s.progressCache))
	missingIDs := []int{}

	for id := range validIDs {
		if p, ok := s.progressCache[id]; ok {
			result[id] = p
		} else {
			missingIDs = append(missingIDs, id)
		}
	}
	s.mu.Unlock()

	if len(missingIDs) > 0 {
		var mu sync.Mutex
		var wg sync.WaitGroup
		sem := make(chan struct{}, 3)

		for _, id := range missingIDs {
			wg.Add(1)
			go func(bid int) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				p, _, err := s.GetBenchmarkProgress(bid, false)
				if err == nil {
					mu.Lock()
					result[bid] = p
					mu.Unlock()
				}
			}(id)
		}
		wg.Wait()
	}

	return result, nil
}

// RefreshAllBenchmarkProgresses fetches fresh data for all benchmarks.
func (s *Service) RefreshAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	list, err := s.GetBenchmarks()
	if err != nil {
		return nil, err
	}

	uniqueIDs := make(map[int]struct{})
	for _, b := range list {
		for _, d := range b.Difficulties {
			uniqueIDs[d.KovaaksBenchmarkID] = struct{}{}
		}
	}

	results := make(map[int]models.BenchmarkProgress)
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 3)

	for id := range uniqueIDs {
		wg.Add(1)
		go func(bid int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			prog, _, err := s.GetBenchmarkProgress(bid, false)
			if err == nil {
				mu.Lock()
				results[bid] = prog
				mu.Unlock()
			}
		}(id)
	}
	wg.Wait()

	return results, nil
}

// CheckAndRefreshIfNeeded checks if a scenario record updates any benchmark progress.
func (s *Service) CheckAndRefreshIfNeeded(rec models.ScenarioRecord) {
	scenarioName, ok := rec.Stats["Scenario"].(string)
	if !ok {
		return
	}
	scoreVal, ok := rec.Stats["Score"]
	if !ok {
		return
	}
	score := toFloat(scoreVal)

	s.mu.Lock()
	if len(s.progressCache) == 0 {
		_, _ = s.loadCacheLocked()
	}

	nameLower := strings.ToLower(scenarioName)
	bids := s.scenarioIndex[nameLower]

	benchmarksToRefresh := make(map[int]struct{})

	for _, bid := range bids {
		progress, ok := s.progressCache[bid]
		if !ok {
			continue
		}

		needsRefresh := false
		for _, cat := range progress.Categories {
			for _, group := range cat.Groups {
				for _, scen := range group.Scenarios {
					if strings.EqualFold(scen.Name, scenarioName) {
						if score > scen.Score {
							needsRefresh = true
							break
						}
					}
				}
				if needsRefresh {
					break
				}
			}
			if needsRefresh {
				break
			}
		}
		if needsRefresh {
			benchmarksToRefresh[bid] = struct{}{}
		}
	}
	s.mu.Unlock()

	if len(benchmarksToRefresh) > 0 {
		go func() {
			for bid := range benchmarksToRefresh {
				_, _, _ = s.GetBenchmarkProgress(bid, false)
			}
		}()
	}
}

// GetCachedBenchmarkProgress returns cached progress.
func (s *Service) GetCachedBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.progressCache) == 0 {
		_, _ = s.loadCacheLocked()
	}
	p, ok := s.progressCache[benchmarkId]
	return p, ok
}

package benchmarks

import (
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"refleks/internal/cache"
	"refleks/internal/models"
	"refleks/internal/settings"
)

const defaultProgressRequestDelay = 2 * time.Second

// progressRequest deduplicates both queued and active refreshes for one
// benchmark difficulty. The first caller executes the request; concurrent
// callers wait for the same result.
type progressRequest struct {
	once     sync.Once
	done     chan struct{}
	progress models.BenchmarkProgress
	err      error
}

// Service manages benchmark data and progress tracking.
type Service struct {
	mu                  sync.Mutex
	progressCache       map[int]models.BenchmarkProgress
	progressCacheLoaded bool
	progressRequests    map[int]*progressRequest
	scenarioIndex       map[string][]int
	benchmarksList      []models.Benchmark
	loadErr             error
	benchmarksURL       string
	httpClient          *http.Client
	onProgressUpdated   func(int, models.BenchmarkProgress)
	onBenchmarksUpdated func([]models.Benchmark)
	settingsSvc         *settings.Service
	cacheSvc            *cache.Service

	progressRequestMu    sync.Mutex
	lastProgressRequest  time.Time
	progressRequestDelay time.Duration
}

// NewService creates a new benchmark service.
func NewService(settingsSvc *settings.Service, cacheSvc *cache.Service) *Service {
	s := &Service{
		progressCache:    make(map[int]models.BenchmarkProgress),
		progressRequests: make(map[int]*progressRequest),
		scenarioIndex:    make(map[string][]int),
		benchmarksURL:    resolveBenchmarksEndpoint(),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		settingsSvc:          settingsSvc,
		cacheSvc:             cacheSvc,
		progressRequestDelay: defaultProgressRequestDelay,
	}
	// Register cache clear callback
	cacheSvc.RegisterOnClear(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.progressCache = make(map[int]models.BenchmarkProgress)
		s.progressCacheLoaded = false
		s.progressRequests = make(map[int]*progressRequest)
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

func (s *Service) SetOnBenchmarksUpdated(cb func([]models.Benchmark)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onBenchmarksUpdated = cb
}

// GetBenchmarkProgress returns progress for a specific benchmark.
func (s *Service) GetBenchmarkProgress(benchmarkId int, useCache bool) (models.BenchmarkProgress, bool, error) {
	if useCache {
		if p, ok := s.GetCachedBenchmarkProgress(benchmarkId); ok {
			return p, true, nil
		}
	}

	request := s.getOrCreateProgressRequest(benchmarkId)
	progress, err := s.executeProgressRequest(benchmarkId, request)
	return progress, false, err
}

func (s *Service) getOrCreateProgressRequest(benchmarkID int) *progressRequest {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.ensureProgressCacheLoadedLocked()
	if request, ok := s.progressRequests[benchmarkID]; ok {
		return request
	}

	request := &progressRequest{done: make(chan struct{})}
	s.progressRequests[benchmarkID] = request
	return request
}

func (s *Service) executeProgressRequest(benchmarkID int, request *progressRequest) (models.BenchmarkProgress, error) {
	request.once.Do(func() {
		raw, err := s.GetPlayerProgressRaw(benchmarkID)
		if err == nil {
			request.progress, err = s.buildStructuredProgress(raw, benchmarkID)
		}
		if err == nil {
			err = s.storeProgress(benchmarkID, request.progress)
		}
		request.err = err

		close(request.done)
		s.mu.Lock()
		if current, ok := s.progressRequests[benchmarkID]; ok && current == request {
			delete(s.progressRequests, benchmarkID)
		}
		s.mu.Unlock()
	})

	<-request.done
	return request.progress, request.err
}

func (s *Service) storeProgress(benchmarkID int, progress models.BenchmarkProgress) error {
	s.mu.Lock()
	s.ensureProgressCacheLoadedLocked()
	s.progressCache[benchmarkID] = progress
	err := s.saveCacheLocked()
	callback := s.onProgressUpdated
	s.mu.Unlock()

	if err != nil {
		return err
	}
	if callback != nil {
		callback(benchmarkID, progress)
	}
	return nil
}

// GetAllBenchmarkProgresses returns progress for all benchmarks.
func (s *Service) GetAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	list, err := s.GetBenchmarks()
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.ensureProgressCacheLoadedLocked()

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

	sort.Ints(missingIDs)
	if len(missingIDs) > 0 {
		s.enqueueBenchmarkProgressRefreshes(missingIDs)
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

	results := make(map[int]models.BenchmarkProgress, len(uniqueIDs))
	ids := make([]int, 0, len(uniqueIDs))
	for id := range uniqueIDs {
		ids = append(ids, id)
	}
	sort.Ints(ids)

	for _, id := range ids {
		prog, _, err := s.GetBenchmarkProgress(id, false)
		if err == nil {
			results[id] = prog
		}
	}

	return results, nil
}

// CheckAndRefreshIfNeeded checks if a run updates any benchmark progress.
func (s *Service) CheckAndRefreshIfNeeded(rec models.RunRecord) {
	if rec.Stats.Summary.Scenario == "" {
		return
	}
	scenarioName := rec.Stats.Summary.Scenario
	score := rec.Stats.Summary.Score

	s.mu.Lock()
	s.ensureProgressCacheLoadedLocked()

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
		ids := make([]int, 0, len(benchmarksToRefresh))
		for bid := range benchmarksToRefresh {
			ids = append(ids, bid)
		}
		sort.Ints(ids)
		s.enqueueBenchmarkProgressRefreshes(ids)
	}
}

// GetCachedBenchmarkProgress returns cached progress.
func (s *Service) GetCachedBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.ensureProgressCacheLoadedLocked()
	p, ok := s.progressCache[benchmarkId]
	return p, ok
}

// QueueBenchmarkProgressRefresh schedules a deduplicated background refresh
// for one benchmark difficulty.
func (s *Service) QueueBenchmarkProgressRefresh(benchmarkID int) {
	s.enqueueBenchmarkProgressRefreshes([]int{benchmarkID})
}

func (s *Service) enqueueBenchmarkProgressRefreshes(ids []int) {
	queued := make([]int, 0, len(ids))

	s.mu.Lock()
	for _, id := range ids {
		if _, ok := s.progressRequests[id]; ok {
			continue
		}
		s.progressRequests[id] = &progressRequest{done: make(chan struct{})}
		queued = append(queued, id)
	}
	s.mu.Unlock()

	if len(queued) == 0 {
		return
	}

	go func() {
		for _, id := range queued {
			s.mu.Lock()
			request := s.progressRequests[id]
			s.mu.Unlock()
			if request == nil {
				continue
			}
			s.executeProgressRequest(id, request)
		}
	}()
}

package benchmarks

import (
	"encoding/json"
	"net/http"
	"reflect"
	"slices"
	"strconv"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func progressWithScenarios(scenarios ...models.ScenarioProgress) models.BenchmarkProgress {
	return models.BenchmarkProgress{
		Categories: []models.ProgressCategory{{Groups: []models.ProgressGroup{{Scenarios: scenarios}}}},
	}
}

func TestProgressCacheLoadsAndIndexesPersistedScenarios(t *testing.T) {
	s := newProgressTestService(t, func(*http.Request) (*http.Response, error) {
		t.Error("cached progress must not make an HTTP request")
		return progressResponse("{}"), nil
	})
	want := map[int]models.BenchmarkProgress{
		42: progressWithScenarios(
			models.ScenarioProgress{Name: "Scenario A", Score: 100},
			models.ScenarioProgress{Name: "SCENARIO A", Score: 90},
		),
		43: progressWithScenarios(models.ScenarioProgress{Name: "scenario a", Score: 80}),
	}
	if err := s.cacheSvc.Save(constants.BenchmarkProgressCacheFileName, want); err != nil {
		t.Fatal(err)
	}
	got, ok := s.GetCachedBenchmarkProgress(42)
	if !ok || !reflect.DeepEqual(got, want[42]) {
		t.Fatalf("cached progress = %+v, %v; want %+v", got, ok, want[42])
	}
	s.mu.Lock()
	ids := append([]int(nil), s.scenarioIndex["scenario a"]...)
	s.mu.Unlock()
	slices.Sort(ids)
	if !reflect.DeepEqual(ids, []int{42, 43}) {
		t.Errorf("scenario index = %v, want [42 43] without duplicates", ids)
	}
}

func TestProgressCacheRecoversFromInvalidOrNullData(t *testing.T) {
	for _, raw := range []string{`"wrong shape"`, `null`} {
		t.Run(raw, func(t *testing.T) {
			s := newProgressTestService(t, func(*http.Request) (*http.Response, error) {
				return progressResponse("{}"), nil
			})
			if err := s.cacheSvc.Save(constants.BenchmarkProgressCacheFileName, json.RawMessage(raw)); err != nil {
				t.Fatal(err)
			}
			if _, ok := s.GetCachedBenchmarkProgress(42); ok {
				t.Fatal("invalid or null cache returned a progress entry")
			}
			want := progressWithScenarios(models.ScenarioProgress{Name: "Recovered", Score: 20})
			if err := s.storeProgress(42, want); err != nil {
				t.Fatalf("storeProgress after recovery: %v", err)
			}
			var persisted map[int]models.BenchmarkProgress
			if err := s.cacheSvc.Load(constants.BenchmarkProgressCacheFileName, &persisted); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(persisted[42], want) {
				t.Errorf("persisted progress = %+v, want %+v", persisted[42], want)
			}
		})
	}
}

func TestClearCacheInvalidatesBenchmarkServiceState(t *testing.T) {
	s := newProgressTestService(t, func(*http.Request) (*http.Response, error) {
		return progressResponse("{}"), nil
	})
	if err := s.storeProgress(42, progressWithScenarios(models.ScenarioProgress{Name: "Scenario A"})); err != nil {
		t.Fatal(err)
	}
	if err := s.cacheSvc.ClearAll(); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	if len(s.progressCache) != 0 || len(s.scenarioIndex) != 0 || len(s.benchmarksList) != 0 || s.progressCacheLoaded {
		t.Error("ClearAll left stale benchmark state in memory")
	}
	s.mu.Unlock()
	if _, ok := s.GetCachedBenchmarkProgress(42); ok {
		t.Error("cached progress survived ClearAll")
	}
}

func TestGetAllBenchmarkProgressesPrunesObsoleteEntries(t *testing.T) {
	s := newProgressTestService(t, func(*http.Request) (*http.Response, error) {
		t.Error("complete progress cache must not be refreshed")
		return progressResponse("{}"), nil
	})
	s.benchmarksList = []models.Benchmark{{Difficulties: []models.BenchmarkDifficulty{{KovaaksBenchmarkID: 42}}}}
	for _, id := range []int{42, 99} {
		if err := s.storeProgress(id, models.BenchmarkProgress{OverallRank: id}); err != nil {
			t.Fatal(err)
		}
	}
	got, err := s.GetAllBenchmarkProgresses()
	if err != nil || len(got) != 1 || got[42].OverallRank != 42 {
		t.Fatalf("GetAllBenchmarkProgresses = %+v, %v", got, err)
	}
	var persisted map[int]models.BenchmarkProgress
	if err := s.cacheSvc.Load(constants.BenchmarkProgressCacheFileName, &persisted); err != nil {
		t.Fatal(err)
	}
	if _, ok := persisted[99]; ok {
		t.Error("obsolete progress was not removed from disk")
	}
	delete(got, 42)
	if _, ok := s.GetCachedBenchmarkProgress(42); !ok {
		t.Error("returned map aliases the service cache")
	}
}

func TestCheckAndRefreshIfNeededOnlyRefreshesImprovedScores(t *testing.T) {
	tests := []struct {
		name     string
		scenario string
		score    float64
		wantIDs  []int
	}{
		{"missing scenario", "", 200, nil},
		{"unrelated scenario", "Other", 200, nil},
		{"lower score", "Scenario A", 90, nil},
		{"equal score", "Scenario A", 100, nil},
		{"case insensitive improvement", "SCENARIO A", 150, []int{42}},
		{"improves multiple benchmarks", "Scenario A", 250, []int{42, 43}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requested := make(chan int, 4)
			s := newProgressTestService(t, func(req *http.Request) (*http.Response, error) {
				id, err := strconv.Atoi(req.URL.Query().Get("benchmarkId"))
				if err != nil {
					t.Error(err)
				}
				requested <- id
				return progressResponse("{invalid json"), nil
			})
			for id, score := range map[int]float64{42: 100, 43: 200} {
				if err := s.storeProgress(id, progressWithScenarios(
					models.ScenarioProgress{Name: "Scenario A", Score: score},
					models.ScenarioProgress{Name: "scenario a", Score: score},
				)); err != nil {
					t.Fatal(err)
				}
			}
			s.CheckAndRefreshIfNeeded(models.RunRecord{Stats: models.RunStatsData{
				Summary: models.RunStatsSummary{Scenario: tt.scenario, Score: tt.score},
			}})
			// Queue registration is synchronous, so waiting for its removal also
			// waits for every background request, including the no-refresh cases.
			waitForProgressRequestRemoved(t, s)
			var got []int
			for len(requested) > 0 {
				got = append(got, <-requested)
			}
			if !reflect.DeepEqual(got, tt.wantIDs) {
				t.Errorf("refreshed benchmark IDs = %v, want %v", got, tt.wantIDs)
			}
		})
	}
}

func TestRefreshAllBenchmarkProgressesDeduplicatesAndContinuesAfterFailure(t *testing.T) {
	var requested []int
	s := newProgressTestService(t, func(req *http.Request) (*http.Response, error) {
		id, err := strconv.Atoi(req.URL.Query().Get("benchmarkId"))
		if err != nil {
			t.Error(err)
		}
		requested = append(requested, id)
		if id == 43 {
			return progressResponse("{invalid json"), nil
		}
		return progressResponse(`{"overall_rank":2}`), nil
	})
	s.benchmarksList = []models.Benchmark{{Difficulties: []models.BenchmarkDifficulty{
		{KovaaksBenchmarkID: 44}, {KovaaksBenchmarkID: 43}, {KovaaksBenchmarkID: 42}, {KovaaksBenchmarkID: 42},
	}}}
	got, err := s.RefreshAllBenchmarkProgresses()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(requested, []int{42, 43, 44}) {
		t.Errorf("requested IDs = %v, want [42 43 44]", requested)
	}
	if len(got) != 2 || got[42].OverallRank != 2 || got[44].OverallRank != 2 {
		t.Errorf("refresh results = %+v, want successful benchmarks only", got)
	}
}

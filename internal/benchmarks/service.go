package benchmarks

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"refleks/internal/benchmarks/rankcalc"
	"refleks/internal/cache"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/settings"
	"refleks/internal/steam"
	"refleks/internal/util"
)

//go:embed benchmarks_data.json
var embeddedBenchmarks []byte

// Service manages benchmark data and progress tracking.
type Service struct {
	mu                sync.Mutex
	progressCache     map[int]models.BenchmarkProgress
	scenarioIndex     map[string][]int
	benchmarksList    []models.Benchmark
	loadOnce          sync.Once
	loadErr           error
	onProgressUpdated func(int, models.BenchmarkProgress)
	settingsSvc       *settings.Service
	cacheSvc          *cache.Service
}

// NewService creates a new benchmark service.
func NewService(settingsSvc *settings.Service, cacheSvc *cache.Service) *Service {
	s := &Service{
		progressCache: make(map[int]models.BenchmarkProgress),
		scenarioIndex: make(map[string][]int),
		settingsSvc:   settingsSvc,
		cacheSvc:      cacheSvc,
	}
	// Register cache clear callback
	cacheSvc.RegisterOnClear(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.progressCache = make(map[int]models.BenchmarkProgress)
		s.scenarioIndex = make(map[string][]int)
	})
	return s
}

// SetOnProgressUpdated sets the callback for when progress is updated.
func (s *Service) SetOnProgressUpdated(cb func(int, models.BenchmarkProgress)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onProgressUpdated = cb
}

// GetBenchmarks returns the list of available benchmarks.
func (s *Service) GetBenchmarks() ([]models.Benchmark, error) {
	s.loadOnce.Do(func() {
		if len(embeddedBenchmarks) == 0 {
			s.loadErr = errors.New("embedded benchmarks data is empty")
			return
		}
		if err := json.Unmarshal(embeddedBenchmarks, &s.benchmarksList); err != nil {
			s.loadErr = fmt.Errorf("failed to parse embedded benchmarks: %w", err)
			return
		}
	})
	return s.benchmarksList, s.loadErr
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
	score := util.ToFloat(scoreVal)

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

// Internal helpers

func (s *Service) GetPlayerProgressRaw(benchmarkId int) (string, error) {
	steamID := steam.GetSteamID(s.settingsSvc.Get())
	if steamID == "" {
		return "", errors.New("steam ID not found")
	}
	url := fmt.Sprintf(constants.KovaaksPlayerProgressURL, benchmarkId, steamID)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch player progress: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d from progress endpoint", resp.StatusCode)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read progress response: %w", err)
	}
	return string(b), nil
}

func (s *Service) rebuildScenarioIndexLocked() {
	s.scenarioIndex = make(map[string][]int)
	for bid, prog := range s.progressCache {
		for _, cat := range prog.Categories {
			for _, group := range cat.Groups {
				for _, scen := range group.Scenarios {
					name := strings.ToLower(scen.Name)
					found := false
					for _, existingID := range s.scenarioIndex[name] {
						if existingID == bid {
							found = true
							break
						}
					}
					if !found {
						s.scenarioIndex[name] = append(s.scenarioIndex[name], bid)
					}
				}
			}
		}
	}
}

func (s *Service) saveCacheLocked() error {
	s.rebuildScenarioIndexLocked()
	return s.cacheSvc.Save(constants.BenchmarksCacheFileName, s.progressCache)
}

func (s *Service) loadCacheLocked() (map[int]models.BenchmarkProgress, error) {
	if !s.cacheSvc.Exists(constants.BenchmarksCacheFileName) {
		return make(map[int]models.BenchmarkProgress), nil
	}
	var data map[int]models.BenchmarkProgress
	if err := s.cacheSvc.Load(constants.BenchmarksCacheFileName, &data); err != nil {
		return nil, err
	}
	s.progressCache = data
	s.rebuildScenarioIndexLocked()
	return data, nil
}

// Parsing logic (stateless)

func (s *Service) buildStructuredProgress(raw string, benchmarkId int) (models.BenchmarkProgress, error) {
	var out models.BenchmarkProgress

	scenarios, ranks, overallRank, benchProg, err := parseProgressTokens(raw)
	if err != nil {
		return out, err
	}

	b, diff := s.findDifficultyByBenchmarkID(benchmarkId)

	out.Ranks = mergeRankDefs(ranks, diff)
	out.OverallRank = overallRank
	out.BenchmarkProgress = benchProg
	out.Categories = groupScenariosByMeta(scenarios, diff)

	if b != nil {
		rankcalc.UpdateEnergies(b.RankCalculation, b, diff, &out.Categories)
	}

	return out, nil
}

func (s *Service) findDifficultyByBenchmarkID(benchmarkId int) (*models.Benchmark, *models.BenchmarkDifficulty) {
	list, err := s.GetBenchmarks()
	if err != nil {
		return nil, nil
	}
	for i := range list {
		b := &list[i]
		for j := range b.Difficulties {
			d := &b.Difficulties[j]
			if d.KovaaksBenchmarkID == benchmarkId {
				return b, d
			}
		}
	}
	return nil, nil
}

// ... (include helper functions: mergeRankDefs, groupScenariosByMeta, parseProgressTokens, etc.)
// I will copy them from the original file.

type rawRank struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

func mergeRankDefs(ranks []rawRank, diff *models.BenchmarkDifficulty) []models.RankDef {
	defs := make([]models.RankDef, 0, len(ranks))
	var rankColors map[string]string
	if diff != nil && diff.RankColors != nil {
		rankColors = diff.RankColors
	}
	for _, r := range ranks {
		name := strings.TrimSpace(r.Name)
		if strings.EqualFold(name, "no rank") || name == "" {
			continue
		}
		col := strings.TrimSpace(r.Color)
		for k, v := range rankColors {
			if strings.EqualFold(strings.TrimSpace(k), name) && strings.TrimSpace(v) != "" {
				col = strings.TrimSpace(v)
				break
			}
		}
		if col == "" {
			col = "#60a5fa"
		}
		defs = append(defs, models.RankDef{Name: name, Color: col})
	}
	return defs
}

func groupScenariosByMeta(scenarios []models.ScenarioProgress, diff *models.BenchmarkDifficulty) []models.ProgressCategory {
	cats := []models.ProgressCategory{}
	pos := 0
	if diff == nil || len(diff.Categories) == 0 {
		g := models.ProgressGroup{Scenarios: make([]models.ScenarioProgress, 0, len(scenarios))}
		g.Scenarios = append(g.Scenarios, scenarios...)
		cats = append(cats, models.ProgressCategory{Name: "", Color: "", Groups: []models.ProgressGroup{g}})
		return cats
	}

	for ci, c := range diff.Categories {
		pc := models.ProgressCategory{Name: c.CategoryName, Color: c.Color}
		groups := make([]models.ProgressGroup, 0, len(c.Subcategories))
		for _, sub := range c.Subcategories {
			take := sub.ScenarioCount
			if take < 0 {
				take = 0
			}
			end := pos + take
			if end > len(scenarios) {
				end = len(scenarios)
			}
			g := models.ProgressGroup{Name: sub.SubcategoryName, Color: sub.Color}
			if end > pos {
				g.Scenarios = append(g.Scenarios, scenarios[pos:end]...)
			}
			pos = end
			groups = append(groups, g)
		}
		if ci == len(diff.Categories)-1 && pos < len(scenarios) {
			g := models.ProgressGroup{}
			g.Scenarios = append(g.Scenarios, scenarios[pos:]...)
			pos = len(scenarios)
			groups = append(groups, g)
		}
		pc.Groups = groups
		cats = append(cats, pc)
	}
	return cats
}

func parseProgressTokens(raw string) (scenarios []models.ScenarioProgress, ranks []rawRank, overallRank int, benchProg float64, err error) {
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	scenarios = []models.ScenarioProgress{}
	var tok json.Token
	if tok, err = dec.Token(); err != nil {
		return
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		err = fmt.Errorf("progress: expected object start")
		return
	}
	for dec.More() {
		kt, e := dec.Token()
		if e != nil {
			err = e
			return
		}
		key, _ := kt.(string)
		switch key {
		case "categories":
			if e := parseCategories(dec, &scenarios); e != nil {
				err = e
				return
			}
		case "ranks":
			var rr []rawRank
			if e := dec.Decode(&rr); e != nil {
				err = e
				return
			}
			for _, r := range rr {
				if strings.EqualFold(strings.TrimSpace(r.Name), "no rank") {
					continue
				}
				ranks = append(ranks, r)
			}
		case "overall_rank":
			var n json.Number
			if e := dec.Decode(&n); e != nil {
				err = e
				return
			}
			if v, e2 := n.Int64(); e2 == nil {
				overallRank = int(v)
			}
		case "benchmark_progress":
			var n json.Number
			if e := dec.Decode(&n); e != nil {
				err = e
				return
			}
			if f, e2 := n.Float64(); e2 == nil {
				benchProg = f
			}
		default:
			var discard any
			if e := dec.Decode(&discard); e != nil {
				err = e
				return
			}
		}
	}
	if _, e := dec.Token(); e != nil {
		err = e
		return
	}
	return
}

func parseCategories(dec *json.Decoder, scenarios *[]models.ScenarioProgress) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := t.(json.Delim)
	if !ok || d != '{' {
		return fmt.Errorf("categories: expected '{'")
	}
	for dec.More() {
		if _, err := dec.Token(); err != nil {
			return err
		}
		t2, err := dec.Token()
		if err != nil {
			return err
		}
		d2, ok := t2.(json.Delim)
		if !ok || d2 != '{' {
			return fmt.Errorf("categories: expected category object")
		}
		for dec.More() {
			fkeyTok, err := dec.Token()
			if err != nil {
				return err
			}
			fkey, _ := fkeyTok.(string)
			if fkey == "scenarios" {
				if err := parseScenarios(dec, scenarios); err != nil {
					return err
				}
				continue
			}
			var discard any
			if err := dec.Decode(&discard); err != nil {
				return err
			}
		}
		if _, err := dec.Token(); err != nil {
			return err
		}
	}
	_, err = dec.Token()
	return err
}

func parseScenarios(dec *json.Decoder, scenarios *[]models.ScenarioProgress) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := t.(json.Delim)
	if !ok || d != '{' {
		return fmt.Errorf("scenarios: expected '{'")
	}
	for dec.More() {
		nt, err := dec.Token()
		if err != nil {
			return err
		}
		name, _ := nt.(string)
		t2, err := dec.Token()
		if err != nil {
			return err
		}
		d2, ok := t2.(json.Delim)
		if !ok || d2 != '{' {
			return fmt.Errorf("scenario: expected object")
		}
		s := models.ScenarioProgress{Name: name}
		for dec.More() {
			fkTok, err := dec.Token()
			if err != nil {
				return err
			}
			fk, _ := fkTok.(string)
			switch fk {
			case "score":
				var n json.Number
				if err := dec.Decode(&n); err != nil {
					return err
				}
				if f, e2 := n.Float64(); e2 == nil {
					s.Score = f / 100.0
				}
			case "scenario_rank":
				var n json.Number
				if err := dec.Decode(&n); err != nil {
					return err
				}
				if v, e2 := n.Int64(); e2 == nil {
					s.ScenarioRank = int(v)
				}
			case "rank_maxes":
				var arr []json.Number
				if err := dec.Decode(&arr); err != nil {
					return err
				}
				for _, n := range arr {
					if f, e2 := n.Float64(); e2 == nil {
						s.Thresholds = append(s.Thresholds, f)
					}
				}
			default:
				var discard any
				if err := dec.Decode(&discard); err != nil {
					return err
				}
			}
		}
		if _, err := dec.Token(); err != nil {
			return err
		}
		if len(s.Thresholds) > 0 {
			base := initialThresholdBaselineGo(s.Thresholds)
			s.Thresholds = append([]float64{base}, s.Thresholds...)
			maxThreshold := s.Thresholds[len(s.Thresholds)-1]
			if maxThreshold > 0 {
				s.Progress = (s.Score / maxThreshold) * 100.0
			}
		}
		*scenarios = append(*scenarios, s)
	}
	_, err = dec.Token()
	return err
}

func initialThresholdBaselineGo(thresholds []float64) float64 {
	n := len(thresholds)
	if n <= 1 {
		return 0
	}
	diffs := make([]float64, 0, n-1)
	for i := 1; i < n; i++ {
		a := thresholds[i]
		b := thresholds[i-1]
		d := a - b
		if d > 0 && !math.IsNaN(d) && !math.IsInf(d, 0) {
			diffs = append(diffs, d)
		}
	}
	if len(diffs) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range diffs {
		sum += x
	}
	avg := sum / float64(len(diffs))
	prev := thresholds[0] - avg
	if prev > 0 {
		return prev
	}
	return 0
}

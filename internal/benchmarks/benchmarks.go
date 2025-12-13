package benchmarks

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"refleks/internal/benchmarks/rankcalc"
	"refleks/internal/cache"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/steam"
	"refleks/internal/util"
	"strings"
	"sync"
	"time"
)

//go:embed benchmarks_data.json
var embeddedBenchmarks []byte

var (
	loadOnce            sync.Once
	loadErr             error
	benchmarksListCache []models.Benchmark
	progressCacheMu     sync.Mutex
	memProgressCache    map[int]models.BenchmarkProgress
	memScenarioIndex    map[string][]int
)

const cacheFileName = "benchmarks.json"

func init() {
	cache.RegisterOnClear(func() {
		progressCacheMu.Lock()
		defer progressCacheMu.Unlock()
		memProgressCache = nil
		memScenarioIndex = nil
	})
}

func GetBenchmarks() ([]models.Benchmark, error) {
	loadOnce.Do(func() {
		if len(embeddedBenchmarks) == 0 {
			loadErr = errors.New("embedded benchmarks data is empty")
			return
		}
		if err := json.Unmarshal(embeddedBenchmarks, &benchmarksListCache); err != nil {
			loadErr = fmt.Errorf("failed to parse embedded benchmarks: %w", err)
			return
		}
	})
	return benchmarksListCache, loadErr
}

// GetPlayerProgressRaw fetches the player progress JSON for a given benchmarkId.
// Order is preserved by the caller via a streaming decoder when needed.
func GetPlayerProgressRaw(benchmarkId int) (string, error) {
	steamID := steam.GetSteamID()
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

func GetBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, error) {
	raw, err := GetPlayerProgressRaw(benchmarkId)
	if err != nil {
		return models.BenchmarkProgress{}, err
	}
	return buildStructuredProgress(raw, benchmarkId)
}

// GetAllBenchmarkProgresses returns progress for all benchmarks, using cache if available.
// It also checks for missing benchmarks in the cache and fetches them.
func GetAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	progressCacheMu.Lock()
	cacheData, err := LoadBenchmarkProgressCache()
	progressCacheMu.Unlock()

	if err != nil {
		cacheData = make(map[int]models.BenchmarkProgress)
	}

	list, err := GetBenchmarks()
	if err != nil {
		return cacheData, err
	}

	missingIDs := []int{}
	for _, b := range list {
		for _, d := range b.Difficulties {
			if _, ok := cacheData[d.KovaaksBenchmarkID]; !ok {
				missingIDs = append(missingIDs, d.KovaaksBenchmarkID)
			}
		}
	}

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

				p, err := GetBenchmarkProgress(bid)
				if err == nil {
					mu.Lock()
					cacheData[bid] = p
					mu.Unlock()
				}
			}(id)
		}
		wg.Wait()

		progressCacheMu.Lock()
		// Reload to merge with any concurrent updates
		if current, err := LoadBenchmarkProgressCache(); err == nil {
			for k, v := range cacheData {
				current[k] = v
			}
			cacheData = current
		}
		SaveBenchmarkProgressCache(cacheData)
		progressCacheMu.Unlock()
	}

	return cacheData, nil
}

// RefreshAllBenchmarkProgresses fetches fresh data for all benchmarks and updates the cache.
func RefreshAllBenchmarkProgresses() (map[int]models.BenchmarkProgress, error) {
	list, err := GetBenchmarks()
	if err != nil {
		return nil, err
	}

	// Use a map to track unique KovaaksBenchmarkIDs to avoid duplicate fetches
	uniqueIDs := make(map[int]struct{})
	for _, b := range list {
		for _, d := range b.Difficulties {
			uniqueIDs[d.KovaaksBenchmarkID] = struct{}{}
		}
	}

	results := make(map[int]models.BenchmarkProgress)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Limit concurrency to avoid rate limits or overwhelming the client
	sem := make(chan struct{}, 3)

	for id := range uniqueIDs {
		wg.Add(1)
		go func(bid int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			prog, err := GetBenchmarkProgress(bid)
			if err == nil {
				mu.Lock()
				results[bid] = prog
				mu.Unlock()
			}
		}(id)
	}
	wg.Wait()

	if len(results) > 0 {
		progressCacheMu.Lock()
		if err := SaveBenchmarkProgressCache(results); err != nil {
			// Log error but return results
			fmt.Printf("failed to save cache: %v\n", err)
		}
		progressCacheMu.Unlock()
	}
	return results, nil
}

func rebuildScenarioIndex() {
	memScenarioIndex = make(map[string][]int)
	for bid, prog := range memProgressCache {
		for _, cat := range prog.Categories {
			for _, group := range cat.Groups {
				for _, scen := range group.Scenarios {
					name := strings.ToLower(scen.Name)
					// Avoid duplicates
					found := false
					for _, existingID := range memScenarioIndex[name] {
						if existingID == bid {
							found = true
							break
						}
					}
					if !found {
						memScenarioIndex[name] = append(memScenarioIndex[name], bid)
					}
				}
			}
		}
	}
}

// SaveBenchmarkProgressCache persists the progress map to disk.
func SaveBenchmarkProgressCache(data map[int]models.BenchmarkProgress) error {
	memProgressCache = data
	rebuildScenarioIndex()
	return cache.Save(cacheFileName, data)
}

// LoadBenchmarkProgressCache loads the progress map from disk.
func LoadBenchmarkProgressCache() (map[int]models.BenchmarkProgress, error) {
	if memProgressCache != nil {
		return memProgressCache, nil
	}
	if !cache.Exists(cacheFileName) {
		return make(map[int]models.BenchmarkProgress), nil
	}
	var data map[int]models.BenchmarkProgress
	if err := cache.Load(cacheFileName, &data); err != nil {
		return nil, err
	}
	memProgressCache = data
	rebuildScenarioIndex()
	return data, nil
}

// CheckAndRefreshIfNeeded checks if the given scenario score is a new highscore for any benchmark
// and refreshes that benchmark if so.
func CheckAndRefreshIfNeeded(rec models.ScenarioRecord) {
	scenarioName, ok := rec.Stats["Scenario Name"].(string)
	if !ok {
		return
	}
	scoreVal, ok := rec.Stats["Score"]
	if !ok {
		return
	}
	score := util.ToFloat(scoreVal)

	progressCacheMu.Lock()
	// Ensure cache is loaded
	if memProgressCache == nil {
		_, _ = LoadBenchmarkProgressCache()
	}

	// Use index to find relevant benchmarks
	nameLower := strings.ToLower(scenarioName)
	bids := memScenarioIndex[nameLower]

	benchmarksToRefresh := make(map[int]struct{})

	for _, bid := range bids {
		progress, ok := memProgressCache[bid]
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
	progressCacheMu.Unlock()

	if len(benchmarksToRefresh) > 0 {
		go func() {
			for bid := range benchmarksToRefresh {
				if p, err := GetBenchmarkProgress(bid); err == nil {
					progressCacheMu.Lock()
					// Reload cache to avoid overwriting other updates
					if currentCache, err := LoadBenchmarkProgressCache(); err == nil {
						currentCache[bid] = p
						_ = SaveBenchmarkProgressCache(currentCache)
					}
					progressCacheMu.Unlock()
				}
			}
		}()
	}
}

// GetCachedBenchmarkProgress returns the cached progress for a benchmark, or false if not found.
func GetCachedBenchmarkProgress(benchmarkId int) (models.BenchmarkProgress, bool) {
	progressCacheMu.Lock()
	defer progressCacheMu.Unlock()

	cacheData, err := LoadBenchmarkProgressCache()
	if err != nil {
		return models.BenchmarkProgress{}, false
	}
	p, ok := cacheData[benchmarkId]
	return p, ok
}

// We intentionally parse directly into models.ScenarioProgress to keep our
// downstream data flowing via the canonical type used by the frontend.

type rawRank struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// buildStructuredProgress parses the upstream raw JSON preserving the scenario order,
// then maps it onto the benchmark definitions for the given benchmarkId.
func buildStructuredProgress(raw string, benchmarkId int) (models.BenchmarkProgress, error) {
	var out models.BenchmarkProgress

	// Step 1: parse top-level values using a streaming decoder
	scenarios, ranks, overallRank, benchProg, err := parseProgressTokens(raw)
	if err != nil {
		return out, err
	}

	// Step 2: locate matching difficulty metadata to derive grouping and colors
	b, diff := findDifficultyByBenchmarkID(benchmarkId)

	// Build rank defs combining upstream order with fallback colors from difficulty
	out.Ranks = mergeRankDefs(ranks, diff)
	out.OverallRank = overallRank
	out.BenchmarkProgress = benchProg

	// Step 3: group scenarios into categories/subcategories by scenarioCount
	out.Categories = groupScenariosByMeta(scenarios, diff)

	// Attempt to compute any energies using the benchmark rank calculation.
	if b != nil {
		rankcalc.UpdateEnergies(b.RankCalculation, b, diff, &out.Categories)
	}

	return out, nil
}

func findDifficultyByBenchmarkID(benchmarkId int) (*models.Benchmark, *models.BenchmarkDifficulty) {
	list, err := GetBenchmarks()
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
		// Prefer configured colors from benchmark metadata (case-insensitive match)
		for k, v := range rankColors {
			if strings.EqualFold(strings.TrimSpace(k), name) && strings.TrimSpace(v) != "" {
				col = strings.TrimSpace(v)
				break
			}
		}
		if col == "" {
			col = "#60a5fa" // fallback if no color found anywhere
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

// parseProgressTokens walks the raw JSON token stream to extract ordered scenarios,
// ranks, and summary numbers without decoding into Go maps (which would randomize order).
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
		// category key
		if _, err := dec.Token(); err != nil {
			return err
		}
		// category object start
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
		// Compute and prepend baseline threshold (as we previously did on the frontend)
		if len(s.Thresholds) > 0 {
			base := initialThresholdBaselineGo(s.Thresholds)
			s.Thresholds = append([]float64{base}, s.Thresholds...)

			// Calculate progress percentage relative to the highest threshold
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

// initialThresholdBaselineGo replicates the frontend logic:
// take average diff between successive thresholds and subtract from first threshold, clamped to 0.
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

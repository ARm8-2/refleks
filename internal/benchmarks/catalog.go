package benchmarks

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/settings"
)

func resolveBenchmarksEndpoint() string {
	if env := strings.TrimSpace(settings.GetEnv(constants.EnvBenchmarksURLVar)); env != "" {
		return env
	}
	return constants.RefleksBenchmarksURL
}

// SyncBenchmarksCache fetches benchmark definitions from API and persists them to cache.
func (s *Service) SyncBenchmarksCache() error {
	benchmarks, err := s.fetchBenchmarksFromAPI()
	if err != nil {
		return err
	}
	if err := s.cacheSvc.Save(constants.BenchmarksDataCacheFileName, benchmarks); err != nil {
		return fmt.Errorf("save benchmarks cache: %w", err)
	}

	s.mu.Lock()
	s.benchmarksList = benchmarks
	s.loadErr = nil
	s.mu.Unlock()

	return nil
}

// GetBenchmarks returns the cached benchmark list.
func (s *Service) GetBenchmarks() ([]models.Benchmark, error) {
	s.mu.Lock()
	if len(s.benchmarksList) > 0 {
		out := s.benchmarksList
		s.mu.Unlock()
		return out, nil
	}
	s.mu.Unlock()

	loaded, err := s.loadBenchmarksFromCache()
	if err == nil {
		s.mu.Lock()
		s.benchmarksList = loaded
		s.loadErr = nil
		s.mu.Unlock()
		return loaded, nil
	}

	// First-run fallback: attempt direct API fetch when benchmark cache is missing.
	if syncErr := s.SyncBenchmarksCache(); syncErr == nil {
		s.mu.Lock()
		out := s.benchmarksList
		s.mu.Unlock()
		return out, nil
	}

	s.mu.Lock()
	s.loadErr = err
	s.mu.Unlock()

	return nil, err
}

func (s *Service) loadBenchmarksFromCache() ([]models.Benchmark, error) {
	if !s.cacheSvc.Exists(constants.BenchmarksDataCacheFileName) {
		return nil, errors.New("benchmarks cache missing")
	}
	var data []models.Benchmark
	if err := s.cacheSvc.Load(constants.BenchmarksDataCacheFileName, &data); err != nil {
		return nil, fmt.Errorf("load benchmarks cache: %w", err)
	}
	normalizeBenchmarksShape(data)
	return data, nil
}

func (s *Service) fetchBenchmarksFromAPI() ([]models.Benchmark, error) {
	endpoint := strings.TrimSpace(s.benchmarksURL)
	if endpoint == "" {
		return nil, errors.New("missing benchmarks endpoint")
	}

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build benchmarks request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch benchmarks: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		trimmed := strings.TrimSpace(string(msg))
		if trimmed == "" {
			return nil, fmt.Errorf("benchmarks endpoint returned status %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("benchmarks endpoint returned status %d: %s", resp.StatusCode, trimmed)
	}

	var payload apiBenchmarksResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode benchmarks response: %w", err)
	}

	out := make([]models.Benchmark, 0, len(payload.Benchmarks))
	for _, bench := range payload.Benchmarks {
		m := models.Benchmark{
			BenchmarkName:   bench.BenchmarkName,
			RankCalculation: bench.RankCalculation,
			Abbreviation:    bench.Abbreviation,
			Color:           bench.Color,
			SpreadsheetURL:  bench.SpreadsheetURL,
			Difficulties:    make([]models.BenchmarkDifficulty, 0, len(bench.Difficulties)),
		}

		for _, diff := range bench.Difficulties {
			ranks := make([]models.RankDef, 0, len(diff.Ranks))
			for _, rank := range diff.Ranks {
				name := strings.TrimSpace(rank.Name)
				if name == "" {
					continue
				}
				color := strings.TrimSpace(rank.Color)
				if color == "" {
					color = "#60a5fa"
				}
				ranks = append(ranks, models.RankDef{Name: name, Color: color})
			}

			categories := make([]models.BenchmarkCategory, 0, len(diff.Categories))
			for _, cat := range diff.Categories {
				subs := make([]models.BenchmarkSubcategory, 0, len(cat.Subcategories))
				for _, sub := range cat.Subcategories {
					subs = append(subs, models.BenchmarkSubcategory{
						SubcategoryName: sub.SubcategoryName,
						ScenarioCount:   sub.ScenarioCount,
						Color:           sub.Color,
					})
				}

				categories = append(categories, models.BenchmarkCategory{
					CategoryName:  cat.CategoryName,
					Color:         cat.Color,
					Subcategories: subs,
				})
			}

			id, err := parseBenchmarkID(diff.KovaaksBenchmarkID)
			if err != nil {
				return nil, fmt.Errorf("invalid kovaaksBenchmarkId %q for %s/%s: %w", diff.KovaaksBenchmarkID, bench.BenchmarkName, diff.DifficultyName, err)
			}

			m.Difficulties = append(m.Difficulties, models.BenchmarkDifficulty{
				DifficultyName:     diff.DifficultyName,
				KovaaksBenchmarkID: id,
				Sharecode:          diff.Sharecode,
				Ranks:              ranks,
				Categories:         categories,
			})
		}

		out = append(out, m)
	}

	normalizeBenchmarksShape(out)
	return out, nil
}

func normalizeBenchmarksShape(items []models.Benchmark) {
	for benchmarkIndex := range items {
		benchmark := &items[benchmarkIndex]
		if benchmark.Difficulties == nil {
			benchmark.Difficulties = []models.BenchmarkDifficulty{}
		}

		for difficultyIndex := range benchmark.Difficulties {
			difficulty := &benchmark.Difficulties[difficultyIndex]
			if difficulty.Ranks == nil {
				difficulty.Ranks = []models.RankDef{}
			}
			if difficulty.Categories == nil {
				difficulty.Categories = []models.BenchmarkCategory{}
			}

			for categoryIndex := range difficulty.Categories {
				category := &difficulty.Categories[categoryIndex]
				if category.Subcategories == nil {
					category.Subcategories = []models.BenchmarkSubcategory{}
				}
			}
		}
	}
}

func parseBenchmarkID(raw json.RawMessage) (int, error) {
	var i int64
	if err := json.Unmarshal(raw, &i); err == nil {
		return int(i), nil
	}

	var str string
	if err := json.Unmarshal(raw, &str); err == nil {
		parsed, parseErr := strconv.ParseInt(strings.TrimSpace(str), 10, 64)
		if parseErr != nil {
			return 0, parseErr
		}
		return int(parsed), nil
	}

	return 0, errors.New("benchmark id must be number or numeric string")
}

type apiBenchmarksResponse struct {
	Benchmarks []apiBenchmark `json:"benchmarks"`
}

type apiBenchmark struct {
	BenchmarkName   string          `json:"benchmarkName"`
	RankCalculation string          `json:"rankCalculation"`
	Abbreviation    string          `json:"abbreviation"`
	Color           string          `json:"color"`
	SpreadsheetURL  string          `json:"spreadsheetURL"`
	Difficulties    []apiDifficulty `json:"difficulties"`
}

type apiDifficulty struct {
	DifficultyName     string          `json:"difficultyName"`
	KovaaksBenchmarkID json.RawMessage `json:"kovaaksBenchmarkId"`
	Sharecode          string          `json:"sharecode"`
	Ranks              []apiRank       `json:"ranks"`
	Categories         []apiCategory   `json:"categories"`
}

type apiRank struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type apiCategory struct {
	CategoryName  string           `json:"categoryName"`
	Color         string           `json:"color"`
	Subcategories []apiSubcategory `json:"subcategories"`
}

type apiSubcategory struct {
	SubcategoryName string `json:"subcategoryName"`
	ScenarioCount   int    `json:"scenarioCount"`
	Color           string `json:"color"`
}

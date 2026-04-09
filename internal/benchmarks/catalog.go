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

var errBenchmarksNotModified = errors.New("benchmarks not modified")

type benchmarksCachePayload struct {
	Benchmarks []models.Benchmark `json:"benchmarks"`
	Count      int                `json:"count"`
	ETag       string             `json:"etag,omitempty"`
}

func resolveBenchmarksEndpoint() string {
	if env := strings.TrimSpace(settings.GetEnv(constants.EnvBenchmarksURLVar)); env != "" {
		return env
	}
	return constants.RefleksBenchmarksURL
}

// SyncBenchmarksCache fetches benchmark definitions from API and persists them to cache.
func (s *Service) SyncBenchmarksCache() error {
	cached, cacheErr := s.loadBenchmarksCache()
	if cacheErr != nil {
		cached = benchmarksCachePayload{}
	}

	payload, err := s.fetchBenchmarksFromAPI(cached.ETag)
	if err != nil {
		if errors.Is(err, errBenchmarksNotModified) {
			if len(cached.Benchmarks) == 0 {
				return errBenchmarksCacheMissing
			}
			s.applyBenchmarksCache(cached)
			return nil
		}
		return err
	}

	if err := s.cacheSvc.Save(constants.BenchmarksDataCacheFileName, payload); err != nil {
		return fmt.Errorf("save benchmarks cache: %w", err)
	}
	s.applyBenchmarksCache(payload)

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

	loaded, err := s.loadBenchmarksCache()
	if err == nil {
		s.applyBenchmarksCache(loaded)
		return loaded.Benchmarks, nil
	}

	if syncErr := s.SyncBenchmarksCache(); syncErr == nil {
		s.mu.Lock()
		out := s.benchmarksList
		s.mu.Unlock()
		return out, nil
	} else {
		err = syncErr
	}

	s.mu.Lock()
	s.loadErr = err
	s.mu.Unlock()

	return nil, err
}

var errBenchmarksCacheMissing = errors.New("benchmarks cache missing")

func (s *Service) loadBenchmarksCache() (benchmarksCachePayload, error) {
	if !s.cacheSvc.Exists(constants.BenchmarksDataCacheFileName) {
		return benchmarksCachePayload{}, errBenchmarksCacheMissing
	}

	var raw json.RawMessage
	if err := s.cacheSvc.Load(constants.BenchmarksDataCacheFileName, &raw); err != nil {
		return benchmarksCachePayload{}, fmt.Errorf("load benchmarks cache: %w", err)
	}

	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return benchmarksCachePayload{}, errBenchmarksCacheMissing
	}

	var payload benchmarksCachePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return benchmarksCachePayload{}, fmt.Errorf("decode benchmarks cache: %w", err)
	}
	normalizeBenchmarksShape(payload.Benchmarks)
	if payload.Count <= 0 {
		payload.Count = len(payload.Benchmarks)
	}
	return payload, nil
}

func (s *Service) applyBenchmarksCache(payload benchmarksCachePayload) {
	normalizeBenchmarksShape(payload.Benchmarks)

	s.mu.Lock()
	s.benchmarksList = payload.Benchmarks
	s.loadErr = nil
	cb := s.onBenchmarksUpdated
	items := append([]models.Benchmark(nil), payload.Benchmarks...)
	s.mu.Unlock()

	if cb != nil {
		cb(items)
	}
}

func (s *Service) fetchBenchmarksFromAPI(ifNoneMatch string) (benchmarksCachePayload, error) {
	endpoint := strings.TrimSpace(s.benchmarksURL)
	if endpoint == "" {
		return benchmarksCachePayload{}, errors.New("missing benchmarks endpoint")
	}

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return benchmarksCachePayload{}, fmt.Errorf("build benchmarks request: %w", err)
	}
	if tag := strings.TrimSpace(ifNoneMatch); tag != "" {
		req.Header.Set("If-None-Match", tag)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return benchmarksCachePayload{}, fmt.Errorf("fetch benchmarks: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		return benchmarksCachePayload{}, errBenchmarksNotModified
	}

	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		trimmed := strings.TrimSpace(string(msg))
		if trimmed == "" {
			return benchmarksCachePayload{}, fmt.Errorf("benchmarks endpoint returned status %d", resp.StatusCode)
		}
		return benchmarksCachePayload{}, fmt.Errorf("benchmarks endpoint returned status %d: %s", resp.StatusCode, trimmed)
	}

	var payload apiBenchmarksResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return benchmarksCachePayload{}, fmt.Errorf("decode benchmarks response: %w", err)
	}

	out := make([]models.Benchmark, 0, len(payload.Benchmarks))
	for _, bench := range payload.Benchmarks {
		m := models.Benchmark{
			BenchmarkName:   bench.BenchmarkName,
			RankCalculation: bench.RankCalculation,
			Abbreviation:    bench.Abbreviation,
			Color:           bench.Color,
			SpreadsheetURL:  bench.SpreadsheetURL,
			DateAdded:       strings.TrimSpace(bench.DateAdded),
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
				return benchmarksCachePayload{}, fmt.Errorf("invalid kovaaksBenchmarkId %q for %s/%s: %w", diff.KovaaksBenchmarkID, bench.BenchmarkName, diff.DifficultyName, err)
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
	count := payload.Count
	if count <= 0 {
		count = len(out)
	}
	return benchmarksCachePayload{
		Benchmarks: out,
		Count:      count,
		ETag:       strings.TrimSpace(resp.Header.Get("ETag")),
	}, nil
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
	Count      int            `json:"count"`
}

type apiBenchmark struct {
	BenchmarkName   string          `json:"benchmarkName"`
	RankCalculation string          `json:"rankCalculation"`
	Abbreviation    string          `json:"abbreviation"`
	Color           string          `json:"color"`
	SpreadsheetURL  string          `json:"spreadsheetURL"`
	DateAdded       string          `json:"dateAdded"`
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

package benchmarks

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"refleks/internal/models"
)

func TestParseBenchmarkID(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    int
		wantErr bool
	}{
		{"number", "123", 123, false},
		{"numeric string", `"456"`, 456, false},
		{"padded numeric string", `" 789 "`, 789, false},
		{"null decodes to zero", "null", 0, false},
		{"float is rejected", "1.5", 0, true},
		{"non-numeric string", `"abc"`, 0, true},
		{"bool is rejected", "true", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseBenchmarkID(json.RawMessage(tt.raw))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("parseBenchmarkID(%s) = (%d, nil), want error", tt.raw, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseBenchmarkID(%s): %v", tt.raw, err)
			}
			if got != tt.want {
				t.Fatalf("parseBenchmarkID(%s) = %d, want %d", tt.raw, got, tt.want)
			}
		})
	}
}

func TestNormalizeBenchmarksShape(t *testing.T) {
	items := []models.Benchmark{
		{
			Difficulties: []models.BenchmarkDifficulty{
				{Categories: []models.BenchmarkCategory{{}}},
			},
		},
		{},
	}

	normalizeBenchmarksShape(items)

	if items[0].Difficulties == nil || items[0].Difficulties[0].Ranks == nil {
		t.Error("difficulty slices should be non-nil")
	}
	if items[0].Difficulties[0].Categories == nil || items[0].Difficulties[0].Categories[0].Subcategories == nil {
		t.Error("category slices should be non-nil")
	}
	if items[1].Difficulties == nil {
		t.Error("missing difficulties should be initialized")
	}
}

func TestLoadBundledBenchmarksFallback(t *testing.T) {
	payload, err := loadBundledBenchmarksFallback()
	if err != nil {
		t.Fatalf("loadBundledBenchmarksFallback: %v", err)
	}
	if len(payload.Benchmarks) == 0 {
		t.Fatal("bundled fallback has no benchmarks")
	}
	if payload.Count != len(payload.Benchmarks) {
		t.Errorf("Count = %d, want %d", payload.Count, len(payload.Benchmarks))
	}
	for i, b := range payload.Benchmarks {
		if strings.TrimSpace(b.BenchmarkName) == "" {
			t.Errorf("benchmark[%d] has empty name", i)
		}
		if b.Difficulties == nil {
			t.Errorf("benchmark[%d] difficulties = nil, want normalized", i)
		}
	}
}

func newBenchService(t *testing.T, handler http.HandlerFunc) *Service {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return &Service{benchmarksURL: srv.URL, httpClient: srv.Client()}
}

const benchmarkAPIResponse = `{
	"benchmarks": [
		{
			"benchmarkName": "Test Benchmark",
			"rankCalculation": "ra-s5",
			"abbreviation": "TB",
			"color": "#fff",
			"spreadsheetURL": "https://example.com",
			"dateAdded": "  2026-01-01  ",
			"difficulties": [
				{
					"difficultyName": "Intermediate",
					"kovaaksBenchmarkId": 2287,
					"sharecode": "code",
					"ranks": [
						{"name": "Novice", "color": ""},
						{"name": "   ", "color": "#000"}
					],
					"categories": [
						{
							"categoryName": "Cat",
							"color": "#111",
							"subcategories": [
								{"subcategoryName": "Sub", "scenarioCount": 5, "color": "#222"}
							]
						}
					]
				}
			]
		},
		{
			"benchmarkName": "String ID Benchmark",
			"difficulties": [
				{"difficultyName": "Entry", "kovaaksBenchmarkId": " 999 "}
			]
		}
	],
	"count": 7
}`

func TestFetchBenchmarksFromAPISuccess(t *testing.T) {
	s := newBenchService(t, func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("If-None-Match"); got != "" {
			t.Errorf("unexpected If-None-Match %q", got)
		}
		w.Header().Set("ETag", `W/"abc"`)
		_, _ = w.Write([]byte(benchmarkAPIResponse))
	})

	payload, err := s.fetchBenchmarksFromAPI("")
	if err != nil {
		t.Fatalf("fetchBenchmarksFromAPI: %v", err)
	}

	if payload.Count != 7 {
		t.Errorf("Count = %d, want 7", payload.Count)
	}
	if payload.ETag != `W/"abc"` {
		t.Errorf("ETag = %q, want W/\"abc\"", payload.ETag)
	}
	if len(payload.Benchmarks) != 2 {
		t.Fatalf("benchmarks = %d, want 2", len(payload.Benchmarks))
	}

	b := payload.Benchmarks[0]
	if b.BenchmarkName != "Test Benchmark" || b.RankCalculation != "ra-s5" || b.DateAdded != "2026-01-01" {
		t.Errorf("benchmark[0] = %+v", b)
	}
	if len(b.Difficulties) != 1 {
		t.Fatalf("benchmark[0] difficulties = %d, want 1", len(b.Difficulties))
	}
	d := b.Difficulties[0]
	if d.KovaaksBenchmarkID != 2287 || d.Sharecode != "code" {
		t.Errorf("difficulty = %+v", d)
	}
	if len(d.Ranks) != 1 || d.Ranks[0].Name != "Novice" || d.Ranks[0].Color != "#60a5fa" {
		t.Errorf("ranks = %+v, want blank name skipped and color defaulted", d.Ranks)
	}
	if len(d.Categories) != 1 || len(d.Categories[0].Subcategories) != 1 {
		t.Fatalf("categories = %+v", d.Categories)
	}
	sub := d.Categories[0].Subcategories[0]
	if sub.SubcategoryName != "Sub" || sub.ScenarioCount != 5 || sub.Color != "#222" {
		t.Errorf("subcategory = %+v", sub)
	}

	b2 := payload.Benchmarks[1]
	if b2.Difficulties[0].KovaaksBenchmarkID != 999 {
		t.Errorf("string id = %d, want 999", b2.Difficulties[0].KovaaksBenchmarkID)
	}
	if b2.Difficulties[0].Ranks == nil || b2.Difficulties[0].Categories == nil {
		t.Error("missing slices should be normalized to empty, not nil")
	}
}

func TestFetchBenchmarksFromAPIConditionalRequest(t *testing.T) {
	var gotIfNoneMatch string
	s := newBenchService(t, func(w http.ResponseWriter, r *http.Request) {
		gotIfNoneMatch = r.Header.Get("If-None-Match")
		w.WriteHeader(http.StatusNotModified)
	})

	_, err := s.fetchBenchmarksFromAPI(`W/"xyz"`)
	if !errors.Is(err, errBenchmarksNotModified) {
		t.Fatalf("err = %v, want errBenchmarksNotModified", err)
	}
	if gotIfNoneMatch != `W/"xyz"` {
		t.Errorf("If-None-Match = %q, want W/\"xyz\"", gotIfNoneMatch)
	}
}

func TestFetchBenchmarksFromAPIErrors(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
	}{
		{"server error with body", http.StatusInternalServerError, "boom"},
		{"server error without body", http.StatusInternalServerError, ""},
		{"malformed json", http.StatusOK, `{not json`},
		{"invalid benchmark id", http.StatusOK, `{"benchmarks":[{"benchmarkName":"b","difficulties":[{"difficultyName":"d","kovaaksBenchmarkId":"abc"}]}]}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newBenchService(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			})
			if _, err := s.fetchBenchmarksFromAPI(""); err == nil {
				t.Fatal("expected error, got nil")
			}
		})
	}
}

func TestFetchBenchmarksFromAPIMissingEndpoint(t *testing.T) {
	s := &Service{httpClient: http.DefaultClient}
	if _, err := s.fetchBenchmarksFromAPI(""); err == nil {
		t.Fatal("expected error for missing endpoint")
	}
}

package benchmarks

import (
	"math"
	"testing"
)

func TestInitialThresholdBaselineGo(t *testing.T) {
	tests := []struct {
		name string
		in   []float64
		want float64
	}{
		{"nil", nil, 0},
		{"single value", []float64{5}, 0},
		{"uniform gaps yield zero baseline", []float64{100, 200, 300}, 0},
		{"positive baseline", []float64{150, 200, 300}, 75},
		{"non-positive gaps are ignored", []float64{100, 50, 200}, 0},
		{"nan gap is ignored", []float64{100, math.NaN(), 200}, 0},
		{"negative start is clamped to zero", []float64{40, 100}, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := initialThresholdBaselineGo(tt.in); got != tt.want {
				t.Fatalf("initialThresholdBaselineGo(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseProgressTokens(t *testing.T) {
	const raw = `{
		"categories": {
			"Category One": {
				"scenarios": {
					"Scenario A": {"score": 15000, "scenario_rank": 3, "rank_maxes": [100, 200, 300]},
					"Scenario B": {"score": 5000, "scenario_rank": 1, "rank_maxes": [100, 200]}
				}
			}
		},
		"ranks": [{"name": "No Rank", "color": "#000000"}, {"name": "Bronze", "color": "#b08d57"}],
		"overall_rank": 2,
		"benchmark_progress": 37.5
	}`

	scenarios, ranks, overallRank, benchmarkProgress, err := parseProgressTokens(raw)
	if err != nil {
		t.Fatalf("parseProgressTokens: %v", err)
	}

	if len(scenarios) != 2 {
		t.Fatalf("scenarios = %d, want 2", len(scenarios))
	}

	a := scenarios[0]
	if a.Name != "Scenario A" || a.Score != 150 || a.ScenarioRank != 3 {
		t.Errorf("scenario A = %+v", a)
	}
	wantAThresholds := []float64{0, 100, 200, 300}
	if !equalFloats(a.Thresholds, wantAThresholds) {
		t.Errorf("scenario A thresholds = %v, want %v", a.Thresholds, wantAThresholds)
	}
	if a.Progress != 50 {
		t.Errorf("scenario A progress = %v, want 50", a.Progress)
	}

	b := scenarios[1]
	if b.Name != "Scenario B" || b.Score != 50 || b.ScenarioRank != 1 {
		t.Errorf("scenario B = %+v", b)
	}
	wantBThresholds := []float64{0, 100, 200}
	if !equalFloats(b.Thresholds, wantBThresholds) {
		t.Errorf("scenario B thresholds = %v, want %v", b.Thresholds, wantBThresholds)
	}
	if b.Progress != 25 {
		t.Errorf("scenario B progress = %v, want 25", b.Progress)
	}

	if len(ranks) != 1 {
		t.Fatalf("ranks = %v, want the single non-\"No Rank\" entry", ranks)
	}
	if ranks[0].Name != "Bronze" || ranks[0].Color != "#b08d57" {
		t.Errorf("rank = %+v", ranks[0])
	}

	if overallRank != 2 {
		t.Errorf("overallRank = %d, want 2", overallRank)
	}
	if benchmarkProgress != 37.5 {
		t.Errorf("benchmarkProgress = %v, want 37.5", benchmarkProgress)
	}
}

func TestParseProgressTokensWithoutThresholds(t *testing.T) {
	const raw = `{"categories": {"c": {"scenarios": {"S": {"score": 100, "scenario_rank": 0}}}}}`

	scenarios, _, _, _, err := parseProgressTokens(raw)
	if err != nil {
		t.Fatalf("parseProgressTokens: %v", err)
	}
	if len(scenarios) != 1 {
		t.Fatalf("scenarios = %d, want 1", len(scenarios))
	}
	if scenarios[0].Thresholds != nil || scenarios[0].Progress != 0 {
		t.Errorf("scenario = %+v, want no thresholds and zero progress", scenarios[0])
	}
}

func TestParseProgressTokensEmptyObject(t *testing.T) {
	scenarios, ranks, overallRank, benchmarkProgress, err := parseProgressTokens("{}")
	if err != nil {
		t.Fatalf("parseProgressTokens: %v", err)
	}
	if len(scenarios) != 0 || ranks != nil || overallRank != 0 || benchmarkProgress != 0 {
		t.Errorf("unexpected result: scenarios=%v ranks=%v overall=%d progress=%v", scenarios, ranks, overallRank, benchmarkProgress)
	}
}

func TestParseProgressTokensErrors(t *testing.T) {
	for _, raw := range []string{"", "[1,2,3]", "{", "{\"overall_rank\": }"} {
		if _, _, _, _, err := parseProgressTokens(raw); err == nil {
			t.Errorf("parseProgressTokens(%q) = nil error, want error", raw)
		}
	}
}

func equalFloats(a, b []float64) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

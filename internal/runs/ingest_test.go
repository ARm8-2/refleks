package runs

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"refleks/internal/models"
)

func TestIngestMatchingPerformances(t *testing.T) {
	const base = "1w6ts reload v2 - Challenge - 2026.05.22-19.00.33"
	gameDir := t.TempDir()
	statsPath := filepath.Join(gameDir, "stats", base+" Stats.csv")
	perfDir := filepath.Join(gameDir, "performances")
	if err := os.MkdirAll(perfDir, 0o755); err != nil {
		t.Fatal(err)
	}
	perfPath := filepath.Join(perfDir, base+" Performance.perf")
	if got := matchingPerformancesPath(statsPath); got != perfPath {
		t.Fatalf("matchingPerformancesPath = %q, want %q", got, perfPath)
	}
	if got := runFileNameFromStatsPath(statsPath); got != base {
		t.Fatalf("runFileNameFromStatsPath = %q, want %q", got, base)
	}
	if got, err := parseMatchingPerformancesFile(statsPath); err != nil || got != nil {
		t.Fatalf("missing optional performance file = %+v, %v; want nil, nil", got, err)
	}

	fixture := filepath.Join("..", "..", "testdata", "FPSAimTrainer", "performances", base+" Performance.perf")
	data, err := os.ReadFile(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(perfPath, data, 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := parseMatchingPerformancesFile(statsPath)
	if err != nil {
		t.Fatalf("parse matching performance fixture: %v", err)
	}
	if got == nil || got.Header.ScenarioName != "1w6ts reload v2" || len(got.Events) != 353 {
		t.Fatalf("unexpected matched performance data: %+v", got)
	}
	if err := os.WriteFile(perfPath, []byte{0xFF}, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := parseMatchingPerformancesFile(statsPath); err == nil {
		t.Fatal("a present but malformed performance file must not be treated as absent")
	}
}

func TestIngestScenarioWindow(t *testing.T) {
	loc := time.FixedZone("test", 2*60*60)
	end := time.Date(2026, 1, 2, 12, 1, 0, 0, loc)
	midnightEnd := time.Date(2026, 1, 2, 0, 0, 10, 0, loc)
	tests := []struct {
		name      string
		end       time.Time
		challenge string
		events    []models.RunStatsEvent
		wantStart time.Time
	}{
		{
			name: "challenge start takes precedence and preserves microseconds", end: end,
			challenge: "12:00:00.123456", events: []models.RunStatsEvent{{Timestamp: "12:00:30"}},
			wantStart: time.Date(2026, 1, 2, 12, 0, 0, 123456000, loc),
		},
		{
			name: "invalid challenge falls back to first event", end: end,
			challenge: "invalid", events: []models.RunStatsEvent{{Timestamp: "12:00:15.250"}},
			wantStart: time.Date(2026, 1, 2, 12, 0, 15, 250000000, loc),
		},
		{
			name: "missing timestamps use sixty second fallback", end: end,
			wantStart: end.Add(-time.Minute),
		},
		{
			name: "malformed timestamps use sixty second fallback", end: end,
			challenge: "25:00:00", events: []models.RunStatsEvent{{Timestamp: "not a time"}},
			wantStart: end.Add(-time.Minute),
		},
		{
			name: "challenge crosses midnight", end: midnightEnd, challenge: "23:59:10",
			wantStart: time.Date(2026, 1, 1, 23, 59, 10, 0, loc),
		},
		{
			name: "first event crosses midnight", end: midnightEnd,
			events:    []models.RunStatsEvent{{Timestamp: "23:59:50.500"}},
			wantStart: time.Date(2026, 1, 1, 23, 59, 50, 500000000, loc),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start, gotEnd := deriveScenarioWindow(tt.end, models.RunStatsSummary{ChallengeStart: tt.challenge}, tt.events)
			if !start.Equal(tt.wantStart) || start.Location() != loc || !gotEnd.Equal(tt.end) {
				t.Fatalf("window = [%v, %v], want [%v, %v] in %v", start, gotEnd, tt.wantStart, tt.end, loc)
			}
		})
	}
}

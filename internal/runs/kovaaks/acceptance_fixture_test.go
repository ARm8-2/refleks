package kovaaks

import (
	"path/filepath"
	"testing"
)

func TestAcceptanceStatsFixtureParses(t *testing.T) {
	path := filepath.Join(
		"..", "..", "..", "acceptance", "fixtures", "kovaaks",
		"FPSAimTrainer", "stats",
		"Long Sanitized Scenario Name For Wrapping Checks - Challenge - 2026.08.07-20.00.00 Stats.csv",
	)

	stats, err := ParseStatsFile(path)
	if err != nil {
		t.Fatalf("parse acceptance fixture: %v", err)
	}
	if got, want := stats.Summary.Scenario, "Long Sanitized Scenario Name For Wrapping Checks"; got != want {
		t.Fatalf("scenario = %q, want %q", got, want)
	}
	if got, want := stats.Summary.Score, 12345.67; got != want {
		t.Fatalf("score = %v, want %v", got, want)
	}
	if got, want := len(stats.Events), 5; got != want {
		t.Fatalf("events = %d, want %d", got, want)
	}
}

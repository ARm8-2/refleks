package kovaaks

import (
	"path/filepath"
	"testing"
	"time"
)

func TestParseFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantName string
		wantDate time.Time
	}{
		{
			name:     "stats file",
			input:    "1w6ts reload v2 - Challenge - 2026.05.22-19.00.33 Stats.csv",
			wantName: "1w6ts reload v2",
			wantDate: time.Date(2026, 5, 22, 19, 0, 33, 0, time.Local),
		},
		{
			name:     "performance file",
			input:    "1w6ts reload v2 - Challenge - 2026.05.22-19.00.33 Performance.perf",
			wantName: "1w6ts reload v2",
			wantDate: time.Date(2026, 5, 22, 19, 0, 33, 0, time.Local),
		},
		{
			name:     "run file",
			input:    "1w3ts reload Larger - Challenge - 2026.07.23-11.59.45.refleks",
			wantName: "1w3ts reload Larger",
			wantDate: time.Date(2026, 7, 23, 11, 59, 45, 0, time.Local),
		},
		{
			name:     "run file with stats suffix",
			input:    "1w3ts reload Larger - Challenge - 2026.07.23-11.59.45 Stats.refleks",
			wantName: "1w3ts reload Larger",
			wantDate: time.Date(2026, 7, 23, 11, 59, 45, 0, time.Local),
		},
		{
			name:     "full path uses the base name",
			input:    filepath.Join("some", "dir", "Air Pure Medium - Challenge - 2026.05.22-19.03.01 Stats.csv"),
			wantName: "Air Pure Medium",
			wantDate: time.Date(2026, 5, 22, 19, 3, 1, 0, time.Local),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := ParseFilename(tt.input)
			if err != nil {
				t.Fatalf("ParseFilename(%q): %v", tt.input, err)
			}
			if info.ScenarioName != tt.wantName {
				t.Errorf("ScenarioName = %q, want %q", info.ScenarioName, tt.wantName)
			}
			if !info.DatePlayed.Equal(tt.wantDate) {
				t.Errorf("DatePlayed = %v, want %v", info.DatePlayed, tt.wantDate)
			}
		})
	}
}

func TestParseFilenameErrors(t *testing.T) {
	inputs := []string{
		"plain.txt",
		"no-date Stats.csv",
		"scenario - Challenge - 2026.05.22 Stats.csv",
		"scenario - Challenge - 2026.13.01-00.00.00 Stats.csv",
		"scenario - Challenge - 2026.07.23-11.59.45.unknown",
	}
	for _, input := range inputs {
		t.Run(input, func(t *testing.T) {
			if _, err := ParseFilename(input); err == nil {
				t.Fatalf("ParseFilename(%q) = nil error, want error", input)
			}
		})
	}
}

package kovaaks

import (
	"bytes"
	"io"
	"path/filepath"
	"testing"

	"refleks/internal/models"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

func statsFixture(name string) string {
	return filepath.Join("..", "..", "..", "testdata", "FPSAimTrainer", "stats", name)
}

func TestParseStatsFile(t *testing.T) {
	tests := []struct {
		name           string
		file           string
		wantScore      float64
		wantKills      int32
		wantDeaths     int32
		wantHitCount   int32
		wantMissCount  int32
		wantScenario   string
		wantHash       string
		wantSensScale  string
		wantHorizSens  float64
		wantDPI        float64
		wantEventCount int
		wantFirstTS    string
		wantFirstBot   string
	}{
		{
			name:           "reload scenario",
			file:           "1w6ts reload v2 - Challenge - 2026.05.22-19.00.33 Stats.csv",
			wantScore:      88,
			wantKills:      88,
			wantDeaths:     0,
			wantHitCount:   88,
			wantMissCount:  7,
			wantScenario:   "1w6ts reload v2",
			wantHash:       "6f620fc128061f4097d3498c03c42457",
			wantSensScale:  "Battlefield 6",
			wantHorizSens:  17.673321,
			wantDPI:        800,
			wantEventCount: 88,
			wantFirstTS:    "18:59:34.330",
			wantFirstBot:   "target",
		},
		{
			name:           "tracking scenario",
			file:           "Air Pure Medium - Challenge - 2026.05.22-19.03.01 Stats.csv",
			wantScore:      886.056824,
			wantKills:      5,
			wantDeaths:     0,
			wantHitCount:   5000,
			wantMissCount:  5902,
			wantScenario:   "Air Pure Medium",
			wantHash:       "d852bc1c12b4bfd7cac1752067620ce2",
			wantSensScale:  "Battlefield 6",
			wantHorizSens:  17.673321,
			wantDPI:        800,
			wantEventCount: 5,
			wantFirstTS:    "19:01:33.253",
			wantFirstBot:   "AIR1_Short_close",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := ParseStatsFile(statsFixture(tt.file))
			if err != nil {
				t.Fatalf("ParseStatsFile: %v", err)
			}

			s := data.Summary
			if s.Score != tt.wantScore {
				t.Errorf("Score = %v, want %v", s.Score, tt.wantScore)
			}
			if s.Kills != tt.wantKills {
				t.Errorf("Kills = %v, want %v", s.Kills, tt.wantKills)
			}
			if s.Deaths != tt.wantDeaths {
				t.Errorf("Deaths = %v, want %v", s.Deaths, tt.wantDeaths)
			}
			if s.HitCount != tt.wantHitCount {
				t.Errorf("HitCount = %v, want %v", s.HitCount, tt.wantHitCount)
			}
			if s.MissCount != tt.wantMissCount {
				t.Errorf("MissCount = %v, want %v", s.MissCount, tt.wantMissCount)
			}
			if s.Scenario != tt.wantScenario {
				t.Errorf("Scenario = %q, want %q", s.Scenario, tt.wantScenario)
			}
			if s.Hash != tt.wantHash {
				t.Errorf("Hash = %q, want %q", s.Hash, tt.wantHash)
			}
			if s.SensScale != tt.wantSensScale {
				t.Errorf("SensScale = %q, want %q", s.SensScale, tt.wantSensScale)
			}
			if s.HorizSens != tt.wantHorizSens {
				t.Errorf("HorizSens = %v, want %v", s.HorizSens, tt.wantHorizSens)
			}
			if s.DPI != tt.wantDPI {
				t.Errorf("DPI = %v, want %v", s.DPI, tt.wantDPI)
			}

			if len(data.Events) != tt.wantEventCount {
				t.Fatalf("events = %d, want %d", len(data.Events), tt.wantEventCount)
			}
			first := data.Events[0]
			if first.KillIndex != 1 {
				t.Errorf("first KillIndex = %d, want 1", first.KillIndex)
			}
			if first.Timestamp != tt.wantFirstTS {
				t.Errorf("first Timestamp = %q, want %q", first.Timestamp, tt.wantFirstTS)
			}
			if first.Bot != tt.wantFirstBot {
				t.Errorf("first Bot = %q, want %q", first.Bot, tt.wantFirstBot)
			}
			if first.Weapon == "" {
				t.Error("first Weapon is empty")
			}
		})
	}
}

func TestParseStatsFileMissingFile(t *testing.T) {
	if _, err := ParseStatsFile(statsFixture("does-not-exist.csv")); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestParseStatsSummaryValues(t *testing.T) {
	raw := ParseStatsSummaryValues([]string{
		"Score:,88.0",
		"Kills:,88",
		"Hide Gun:,false",
		"Sens Scale:,Battlefield 6",
		"not a summary line",
	})

	if _, ok := raw["Score"].(float64); !ok {
		t.Errorf("Score type = %T, want float64", raw["Score"])
	}
	if _, ok := raw["Kills"].(int); !ok {
		t.Errorf("Kills type = %T, want int", raw["Kills"])
	}
	if _, ok := raw["Hide Gun"].(bool); !ok {
		t.Errorf("Hide Gun type = %T, want bool", raw["Hide Gun"])
	}
	if _, ok := raw["Sens Scale"].(string); !ok {
		t.Errorf("Sens Scale type = %T, want string", raw["Sens Scale"])
	}
	if _, ok := raw["not a summary line"]; ok {
		t.Error("line without ':,' should be skipped")
	}
}

func TestDecodeStatsSummary(t *testing.T) {
	raw := ParseStatsSummaryValues([]string{
		"Score:,123.5",
		"Kills:,7",
		"Hide Gun:,true",
		"Scenario:,Test Scenario",
	})
	got := DecodeStatsSummary(raw)

	want := models.RunStatsSummary{Score: 123.5, Kills: 7, HideGun: true, Scenario: "Test Scenario"}
	if got != want {
		t.Fatalf("DecodeStatsSummary = %+v, want %+v", got, want)
	}
}

func TestIsKillEventRow(t *testing.T) {
	tests := []struct {
		name string
		row  []string
		want bool
	}{
		{"valid", []string{"1", "18:59:34.330", "target"}, true},
		{"non-numeric index", []string{"Kill #", "Timestamp"}, false},
		{"short timestamp", []string{"1", "18:59"}, false},
		{"bad separators", []string{"1", "18-59-34.330"}, false},
		{"non-digit in timestamp", []string{"1", "1a:59:34.330"}, false},
		{"missing timestamp", []string{"1"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isKillEventRow(tt.row); got != tt.want {
				t.Fatalf("isKillEventRow(%v) = %v, want %v", tt.row, got, tt.want)
			}
		})
	}
}

func TestDecodeStatsEventRows(t *testing.T) {
	rows := [][]string{
		{"1", "18:59:34.330", "target", "BB Gun", "0.000000s", "1", "1", "1.000000", "1.000000", "1.000000", "1.000000", "false", "0"},
		{"2", "19:00:32.736", "target", "BB Gun", "0.500000s", "2", "1", "0.500000", "1.000000", "2.000000", "0.500000", "true", "3"},
		{"not", "a", "kill"},
	}

	events := DecodeStatsEventRows(rows)
	if len(events) != 2 {
		t.Fatalf("events = %d, want 2", len(events))
	}

	first := events[0]
	if first.KillIndex != 1 || first.Timestamp != "18:59:34.330" || first.Bot != "target" || first.Weapon != "BB Gun" {
		t.Errorf("unexpected first event: %+v", first)
	}
	if first.TTKSeconds != 0 || first.Shots != 1 || first.Hits != 1 || first.Accuracy != 1 {
		t.Errorf("unexpected first event numbers: %+v", first)
	}
	if first.Cheated {
		t.Error("first event Cheated = true, want false")
	}

	second := events[1]
	if second.TTKSeconds != 0.5 {
		t.Errorf("second TTKSeconds = %v, want 0.5", second.TTKSeconds)
	}
	if !second.Cheated {
		t.Error("second event Cheated = false, want true")
	}
	if second.OverShots != 3 {
		t.Errorf("second OverShots = %v, want 3", second.OverShots)
	}
}

func TestWrapReaderWithUTF8(t *testing.T) {
	const want = "Score:,88\n"

	utf16Encode := func(t *testing.T, s string, order unicode.Endianness) []byte {
		t.Helper()
		enc := unicode.UTF16(order, unicode.IgnoreBOM).NewEncoder()
		out, _, err := transform.Bytes(enc, []byte(s))
		if err != nil {
			t.Fatalf("encode utf16: %v", err)
		}
		return out
	}

	tests := []struct {
		name  string
		input []byte
	}{
		{"utf-8", []byte(want)},
		{"utf-8 with bom", append([]byte{0xEF, 0xBB, 0xBF}, []byte(want)...)},
		{"utf-16 le with bom", append([]byte{0xFF, 0xFE}, utf16Encode(t, want, unicode.LittleEndian)...)},
		{"utf-16 be with bom", append([]byte{0xFE, 0xFF}, utf16Encode(t, want, unicode.BigEndian)...)},
		{"utf-16 le without bom", utf16Encode(t, want, unicode.LittleEndian)},
		{"utf-16 be without bom", utf16Encode(t, want, unicode.BigEndian)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, err := wrapReaderWithUTF8(bytes.NewReader(tt.input))
			if err != nil {
				t.Fatalf("wrapReaderWithUTF8: %v", err)
			}
			got, err := io.ReadAll(r)
			if err != nil {
				t.Fatalf("ReadAll: %v", err)
			}
			if string(got) != want {
				t.Fatalf("decoded = %q, want %q", got, want)
			}
		})
	}
}

package kovaaks

import (
	"path/filepath"
	"testing"

	"google.golang.org/protobuf/encoding/protowire"
)

func perfFixture(name string) string {
	return filepath.Join("..", "..", "..", "testdata", "FPSAimTrainer", "performances", name)
}

func TestParsePerformancesFile(t *testing.T) {
	tests := []struct {
		name             string
		file             string
		wantScenario     string
		wantHash         string
		wantStartUTC     int64
		wantSchema       uint32
		wantTimeLimit    float32
		wantPlayer       string
		wantBots         []string
		wantMap          string
		wantMapScale     float32
		wantEventCount   int
		wantFirstPayload string
		wantLastPayload  string
	}{
		{
			name:             "reload scenario",
			file:             "1w6ts reload v2 - Challenge - 2026.05.22-19.00.33 Performance.perf",
			wantScenario:     "1w6ts reload v2",
			wantHash:         "6f620fc128061f4097d3498c03c42457",
			wantStartUTC:     1779469173000,
			wantSchema:       1,
			wantTimeLimit:    60,
			wantPlayer:       "Player",
			wantBots:         []string{"target.bot", "target.bot", "target.bot", "target.bot", "target.bot", "target.bot"},
			wantMap:          "cube_1wall_dense.map",
			wantMapScale:     4,
			wantEventCount:   353,
			wantFirstPayload: "shotsFired",
			wantLastPayload:  "kills",
		},
		{
			name:             "tracking scenario",
			file:             "Air Pure Medium - Challenge - 2026.05.22-19.03.01 Performance.perf",
			wantScenario:     "Air Pure Medium",
			wantHash:         "d852bc1c12b4bfd7cac1752067620ce2",
			wantStartUTC:     1779469267000,
			wantSchema:       1,
			wantTimeLimit:    1000,
			wantPlayer:       "A",
			wantBots:         []string{"AIR.rot"},
			wantMap:          "airvertlimited03e_marked01.map",
			wantMapScale:     6,
			wantEventCount:   691,
			wantFirstPayload: "shotsFired",
			wantLastPayload:  "overshots",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := ParsePerformancesFile(perfFixture(tt.file))
			if err != nil {
				t.Fatalf("ParsePerformancesFile: %v", err)
			}

			h := data.Header
			if h.ScenarioName != tt.wantScenario {
				t.Errorf("ScenarioName = %q, want %q", h.ScenarioName, tt.wantScenario)
			}
			if h.ScenarioHash != tt.wantHash {
				t.Errorf("ScenarioHash = %q, want %q", h.ScenarioHash, tt.wantHash)
			}
			if h.ChallengeStartUTC != tt.wantStartUTC {
				t.Errorf("ChallengeStartUTC = %d, want %d", h.ChallengeStartUTC, tt.wantStartUTC)
			}
			if h.SchemaVersion != tt.wantSchema {
				t.Errorf("SchemaVersion = %d, want %d", h.SchemaVersion, tt.wantSchema)
			}
			if h.ChallengeProfile.TimeLimit != tt.wantTimeLimit {
				t.Errorf("TimeLimit = %v, want %v", h.ChallengeProfile.TimeLimit, tt.wantTimeLimit)
			}
			if h.ChallengeProfile.PlayerProfile != tt.wantPlayer {
				t.Errorf("PlayerProfile = %q, want %q", h.ChallengeProfile.PlayerProfile, tt.wantPlayer)
			}
			if len(h.ChallengeProfile.AddedBots) != len(tt.wantBots) {
				t.Fatalf("AddedBots = %v, want %v", h.ChallengeProfile.AddedBots, tt.wantBots)
			}
			for i, bot := range tt.wantBots {
				if h.ChallengeProfile.AddedBots[i] != bot {
					t.Errorf("AddedBots[%d] = %q, want %q", i, h.ChallengeProfile.AddedBots[i], bot)
				}
			}
			if h.ChallengeProfile.MapName != tt.wantMap {
				t.Errorf("MapName = %q, want %q", h.ChallengeProfile.MapName, tt.wantMap)
			}
			if h.ChallengeProfile.MapScale != tt.wantMapScale {
				t.Errorf("MapScale = %v, want %v", h.ChallengeProfile.MapScale, tt.wantMapScale)
			}

			if len(data.Events) != tt.wantEventCount {
				t.Fatalf("events = %d, want %d", len(data.Events), tt.wantEventCount)
			}
			first := data.Events[0]
			if first.PayloadType != tt.wantFirstPayload {
				t.Errorf("first PayloadType = %q, want %q", first.PayloadType, tt.wantFirstPayload)
			}
			if first.Count == nil {
				t.Error("first Count is nil, want non-nil")
			}
			if last := data.Events[len(data.Events)-1]; last.PayloadType != tt.wantLastPayload {
				t.Errorf("last PayloadType = %q, want %q", last.PayloadType, tt.wantLastPayload)
			}
		})
	}
}

func TestParsePerformancesFileErrors(t *testing.T) {
	if _, err := ParsePerformancesFile(perfFixture("does-not-exist.perf")); err == nil {
		t.Fatal("expected error for missing file")
	}

	// A lone continuation byte cannot be decoded into a protobuf tag.
	if _, err := parsePerformancesMessage([]byte{0xFF}); err == nil {
		t.Fatal("expected error for malformed message")
	}
}

func TestPerformancePayloadType(t *testing.T) {
	want := map[protowire.Number]string{
		2:  "shotsFired",
		3:  "shotsHit",
		4:  "shotsMissed",
		5:  "damageDone",
		6:  "damagePossible",
		7:  "score",
		8:  "kills",
		9:  "deaths",
		10: "overshots",
		11: "playerDamageTaken",
		12: "reloads",
		13: "pauseCount",
		14: "distanceTraveled",
		15: "mbsPoints",
		16: "targetSize",
		17: "targetSpeed",
		18: "randomSensScale",
	}

	for field, payload := range want {
		if got := performancePayloadType(field); got != payload {
			t.Errorf("performancePayloadType(%d) = %q, want %q", field, got, payload)
		}
	}
	if got := performancePayloadType(99); got != "" {
		t.Errorf("performancePayloadType(99) = %q, want empty", got)
	}
}

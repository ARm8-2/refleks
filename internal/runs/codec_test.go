package runs

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"refleks/internal/models"

	"github.com/zeebo/xxh3"
)

func TestReadRecordFileRealRun(t *testing.T) {
	path := filepath.Join("..", "..", "testdata", "runs", "1w3ts reload Larger - Challenge - 2026.07.23-11.59.45.refleks")

	rec, err := readRecordFile(path, readRecordOptions{})
	if err != nil {
		t.Fatalf("readRecordFile: %v", err)
	}

	if rec.FileVersion != runVersionV2 {
		t.Errorf("FileVersion = %d, want %d", rec.FileVersion, runVersionV2)
	}
	if want := "1w3ts reload Larger - Challenge - 2026.07.23-11.59.45"; rec.FileName != want {
		t.Errorf("FileName = %q, want %q", rec.FileName, want)
	}
	if rec.EpochMilli != 1784800785000 {
		t.Errorf("EpochMilli = %d, want 1784800785000", rec.EpochMilli)
	}

	s := rec.Stats.Summary
	if s.Score != 76 || s.Kills != 76 || s.Deaths != 0 {
		t.Errorf("summary score/kills/deaths = %v/%v/%v, want 76/76/0", s.Score, s.Kills, s.Deaths)
	}
	if s.Scenario != "1w3ts reload Larger" || s.Hash != "51c94da9e6f2591514f5de7631eae34d" {
		t.Errorf("summary scenario/hash = %q/%q", s.Scenario, s.Hash)
	}
	if s.SensScale != "cm/360" || s.HorizSens != 34.63636 || s.DPI != 800 {
		t.Errorf("summary sens = %q/%v/%v, want cm/360/34.63636/800", s.SensScale, s.HorizSens, s.DPI)
	}
	if len(rec.Stats.Events) != 76 {
		t.Errorf("stats events = %d, want 76", len(rec.Stats.Events))
	}

	if rec.Performances == nil {
		t.Fatal("Performances = nil, want decoded performance data")
	}
	if rec.Performances.Header.ScenarioName != "1w3ts reload Larger" {
		t.Errorf("performance ScenarioName = %q", rec.Performances.Header.ScenarioName)
	}
	if rec.Performances.Header.ChallengeProfile.MapName != "cube_1wall_dense.map" {
		t.Errorf("performance MapName = %q", rec.Performances.Header.ChallengeProfile.MapName)
	}
	if len(rec.Performances.Events) != 342 {
		t.Errorf("performance events = %d, want 342", len(rec.Performances.Events))
	}

	if len(rec.MouseTrace) != 5245 {
		t.Errorf("mouse trace = %d, want 5245", len(rec.MouseTrace))
	}
	if rec.Env.TracePoints != 5245 {
		t.Errorf("env TracePoints = %d, want 5245", rec.Env.TracePoints)
	}
	if rec.Env.AppVersion != "0.8.4" || rec.Env.OS != "windows" || rec.Env.SampleRate != 125 {
		t.Errorf("unexpected env: %+v", rec.Env)
	}
}

func TestWriteReadRecordRoundTrip(t *testing.T) {
	want := sampleRecord()
	path := writeTempRun(t, want)

	got, err := readRecordFile(path, readRecordOptions{})
	if err != nil {
		t.Fatalf("readRecordFile: %v", err)
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("round-trip mismatch\n got: %+v\nwant: %+v", got, want)
	}
}

func TestReadRecordFileSkipOptions(t *testing.T) {
	path := writeTempRun(t, sampleRecord())

	got, err := readRecordFile(path, readRecordOptions{
		skipStatsEvents:       true,
		skipPerformanceEvents: true,
		skipMouseTrace:        true,
	})
	if err != nil {
		t.Fatalf("readRecordFile: %v", err)
	}

	if got.Stats.Summary != sampleRecord().Stats.Summary {
		t.Error("skipping events must not drop the stats summary")
	}
	if got.Stats.Events != nil {
		t.Errorf("stats events = %v, want nil", got.Stats.Events)
	}
	if got.Performances == nil {
		t.Fatal("Performances = nil, want header only")
	}
	if got.Performances.Header.ScenarioName != "scenario-x" {
		t.Errorf("performance header = %+v, want preserved header", got.Performances.Header)
	}
	if got.Performances.Events != nil {
		t.Errorf("performance events = %v, want nil", got.Performances.Events)
	}
	if got.MouseTrace != nil {
		t.Errorf("mouse trace = %v, want nil", got.MouseTrace)
	}
}

func TestReadRecordFileRejectsCorrupt(t *testing.T) {
	valid, err := os.ReadFile(writeTempRun(t, sampleRecord()))
	if err != nil {
		t.Fatal(err)
	}

	flipLast := append([]byte(nil), valid...)
	flipLast[len(flipLast)-1] ^= 0xFF

	tests := []struct {
		name string
		data []byte
	}{
		{"too small", []byte("RFLK")},
		{"bad magic", mutateBytes(valid, 0, 'X')},
		{"unsupported version", mutateBytes(valid, 4, 99)},
		{"truncated checksum", valid[:len(valid)-1]},
		{"checksum mismatch", flipLast},
		{"trailing bytes", append(append([]byte(nil), valid...), 0x00)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "corrupt.refleks")
			if err := os.WriteFile(path, tt.data, 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := readRecordFile(path, readRecordOptions{}); err == nil {
				t.Fatal("expected error, got nil")
			}
		})
	}
}

func TestReadRecordFileV1AndSkipSections(t *testing.T) {
	path := writeV1RunFixture(t)
	got, err := readRecordFile(path, readRecordOptions{})
	if err != nil {
		t.Fatalf("read legacy v1 record: %v", err)
	}
	if got.FileVersion != runVersionV1 || got.FileName != "legacy-run" || got.EpochMilli != 1700000000123 {
		t.Fatalf("legacy record identity = version %d, name %q, epoch %d", got.FileVersion, got.FileName, got.EpochMilli)
	}
	if got.Stats.Summary.Score != 123.5 || got.Stats.Summary.Kills != 3 || got.Stats.Summary.Scenario != "legacy scenario" {
		t.Fatalf("legacy summary = %+v", got.Stats.Summary)
	}
	if len(got.Stats.Events) != 1 || got.Stats.Events[0].Bot != "target" || got.Stats.Events[0].Shots != 2 {
		t.Fatalf("legacy stats events = %+v", got.Stats.Events)
	}
	if got.Performances != nil {
		t.Fatalf("legacy v1 record unexpectedly contains performances: %+v", got.Performances)
	}
	if !reflect.DeepEqual(got.MouseTrace, []models.MousePoint{{TS: 1700000000, X: -2, Y: 7, Buttons: 1}}) {
		t.Fatalf("legacy mouse trace = %+v", got.MouseTrace)
	}
	if got.Env.AppVersion != "0.8.4" || got.Env.OS != "windows" || got.Env.MouseBackend != "rawinput" || got.Env.SampleRate != 125 {
		t.Fatalf("legacy environment = %+v", got.Env)
	}

	skipped, err := readRecordFile(path, readRecordOptions{
		skipStatsEvents: true, skipPerformanceEvents: true, skipMouseTrace: true,
	})
	if err != nil {
		t.Fatalf("read legacy v1 record with skipped sections: %v", err)
	}
	if skipped.Stats.Summary != got.Stats.Summary || skipped.Stats.Events != nil || skipped.MouseTrace != nil || skipped.Env != got.Env {
		t.Fatalf("selective legacy read = %+v", skipped)
	}
}

func writeV1RunFixture(t *testing.T) string {
	t.Helper()
	var payload bytes.Buffer
	mustWrite := func(value any) {
		t.Helper()
		if err := binary.Write(&payload, binary.LittleEndian, value); err != nil {
			t.Fatal(err)
		}
	}
	mustString := func(value string) {
		t.Helper()
		if err := writeString(&payload, value); err != nil {
			t.Fatal(err)
		}
	}

	mustString("legacy-run")
	mustWrite(uint32(3))
	mustString("Score")
	mustWrite(uint8(statTypeFloat))
	mustWrite(float64(123.5))
	mustString("Kills")
	mustWrite(uint8(statTypeInt))
	mustWrite(int64(3))
	mustString("Scenario")
	mustWrite(uint8(statTypeString))
	mustString("legacy scenario")

	mustWrite(uint32(1))
	row := []string{"1", "12:00:01.000", "target", "pistol", "0.5s", "2", "1", "0.5", "10", "20", "0.5", "false", "0"}
	mustWrite(uint32(len(row)))
	for _, value := range row {
		mustString(value)
	}

	mustWrite(uint32(1))
	mustWrite(int64(1700000000))
	mustWrite(int32(-2))
	mustWrite(int32(7))
	mustWrite(int32(1))

	for _, value := range []string{"0.8.4", "windows", "amd64", "Windows 11", "steam-id", "player", "cpu"} {
		mustString(value)
	}
	mustWrite(int32(8))
	mustString("gpu")
	mustWrite(int32(16384))
	mustWrite(float64(144))
	mustWrite(int32(1920))
	mustWrite(int32(1080))
	mustWrite(uint8(1))
	for _, value := range []string{"mouse", "046D", "C539", "01", "rawinput"} {
		mustString(value)
	}
	mustWrite(int32(1))
	mustWrite(float64(60))
	mustWrite(int32(125))

	var file bytes.Buffer
	file.WriteString(runMagic)
	for _, value := range []any{uint8(runVersionV1), uint8(runCompressionNone), int64(1700000000123)} {
		if err := binary.Write(&file, binary.LittleEndian, value); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := file.Write(payload.Bytes()); err != nil {
		t.Fatal(err)
	}
	hasher := xxh3.New()
	if _, err := hasher.Write(payload.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := binary.Write(&file, binary.LittleEndian, hasher.Sum64()); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "legacy.refleks")
	if err := os.WriteFile(path, file.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func sampleRecord() storedRunRecord {
	return storedRunRecord{
		FileVersion: runVersionCurrent,
		FileName:    "sample.refleks",
		EpochMilli:  1700000000000,
		Stats: models.RunStatsData{
			Summary: models.RunStatsSummary{
				Score: 123.5, Kills: 9, Deaths: 2, FightTime: 12.5, TimeRemaining: 1.25,
				AvgTTK: 0.5, DamageDone: 90, TotalOvershots: 3, DamageTaken: 4, HitCount: 9,
				MissCount: 1, Reloads: 1, DistanceTraveled: 10.5, MBSPoints: 2,
				Scenario: "scenario-x", Hash: "deadbeef", GameVersion: "1.2.3",
				ChallengeStart: "12:00:00.000", PauseCount: 1, PauseDuration: 0.5,
				AvgTargetScale: 1, AvgTimeDilation: 1, InputLag: 5, MaxFPSConfig: 999,
				SensScale: "Valorant", SensIncrement: 0.1, HorizSens: 0.5, VertSens: 0.5,
				DPI: 800, FOV: 103, FOVScale: "Valorant", HideGun: true, Crosshair: "ch.png",
				CrosshairScale: 1, CrosshairColor: "ffffffff", Resolution: "1920x1080",
				AvgFPS: 240.5, ResolutionScale: 100, DatePlayed: "2026-01-02T03:04:05Z",
				Accuracy: 0.9, RealAvgTTK: 0.45, Cm360: 32.675, Duration: 60,
				ScenarioTime: 59, Time: 58,
			},
			Events: []models.RunStatsEvent{
				{
					KillIndex: 1, Timestamp: "12:00:01.000", Bot: "bot-a", Weapon: "gun",
					TTKSeconds: 0.25, Shots: 2, Hits: 1, Accuracy: 0.5, DamageDone: 1,
					DamagePossible: 2, Efficiency: 0.5, Cheated: true, OverShots: 1,
				},
			},
		},
		Performances: &models.RunPerformanceData{
			Header: models.RunPerformanceHeader{
				ScenarioName: "scenario-x", ScenarioHash: "deadbeef",
				ChallengeStartUTC: 1700000000000, SchemaVersion: 1,
				ChallengeProfile: models.ChallengeProfileSnapshot{
					TimeLimit: 60, PlayerProfile: "Player", AddedBots: []string{"b1", "b2"},
					BotMaxLives: []int32{0, 0}, PlayerTeam: 1, BotTeams: []int32{0, 0},
					MapName: "map", MapScale: 4, Timescale: 1,
				},
			},
			Events: []models.RunPerformanceEvent{
				{Timestamp: 1.5, PayloadType: "shotsFired", Count: int32Ptr(3)},
				{Timestamp: 2.5, PayloadType: "score", Delta: float32Ptr(1.25)},
				{Timestamp: 3.5, PayloadType: "targetSize", Value: float32Ptr(0.5)},
			},
		},
		MouseTrace: []models.MousePoint{
			{TS: 1000, X: 1, Y: 2, Buttons: 1},
			{TS: 1016, X: -3, Y: 4, Buttons: 0},
		},
		Env: models.RunEnvironment{
			AppVersion: "0.8.4", OS: "windows", Arch: "amd64", OSVersion: "Windows 11",
			SteamID: "123", PersonaName: "player", CPUName: "cpu", CPUCores: 8, GPUName: "gpu",
			RAMTotalMB: 16384, DisplayHz: 240, ScreenWidth: 1920, ScreenHeight: 1080,
			IsWindowed: true, MouseName: "mouse", MouseVID: "372E", MousePID: "1014",
			MouseMI: "00", MouseBackend: "rawinput", TracePoints: 2, TraceDuration: 0.016,
			SampleRate: 1000,
		},
	}
}

func writeTempRun(t *testing.T, rec storedRunRecord) string {
	t.Helper()

	var buf bytes.Buffer
	if err := writeRecord(&buf, rec); err != nil {
		t.Fatalf("writeRecord: %v", err)
	}

	path := filepath.Join(t.TempDir(), "run.refleks")
	if err := os.WriteFile(path, buf.Bytes(), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	return path
}

func mutateBytes(in []byte, at int, b byte) []byte {
	out := append([]byte(nil), in...)
	out[at] = b
	return out
}

func int32Ptr(v int32) *int32       { return &v }
func float32Ptr(v float32) *float32 { return &v }

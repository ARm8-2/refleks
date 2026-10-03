package environment

import (
	"runtime"
	"testing"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
)

type collectorTestMouse struct {
	metadata models.MouseRunMetadata
	calls    int
	start    time.Time
	end      time.Time
}

func (*collectorTestMouse) Enabled() bool { return false }
func (*collectorTestMouse) GetRange(time.Time, time.Time) []models.MousePoint {
	return nil
}
func (m *collectorTestMouse) GetRunMetadata(start, end time.Time) models.MouseRunMetadata {
	m.calls++
	m.start, m.end = start, end
	return m.metadata
}

func TestCollectRunEnvironmentBaseAndMouseMetadata(t *testing.T) {
	start := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	end := start.Add(90 * time.Second)
	mouse := &collectorTestMouse{metadata: models.MouseRunMetadata{
		Backend: " Raw_Input-Win ", DeviceName: "  Test mouse  ",
		VendorID: " 0x046d ", ProductID: "c539", InterfaceNumber: " 0X01 ", SampleRateHz: 500,
	}}

	got := CollectRunEnvironment(mouse, start, end, 12, " 7656119 ", " player ")
	if got.OS != runtime.GOOS || got.Arch != runtime.GOARCH || got.CPUCores <= 0 || got.AppVersion != constants.AppVersion {
		t.Fatalf("base environment = %+v", got)
	}
	if got.SteamID != "7656119" || got.PersonaName != "player" || got.TracePoints != 12 || got.TraceDuration != 90 {
		t.Fatalf("run-window/user environment = %+v", got)
	}
	if got.MouseVID != "046D" || got.MousePID != "C539" || got.MouseMI != "01" ||
		got.MouseName != "Test mouse" || got.MouseBackend != "rawinputwin" || got.SampleRate != 500 {
		t.Fatalf("normalized mouse metadata = %+v", got)
	}
	if mouse.calls != 1 || !mouse.start.Equal(start) || !mouse.end.Equal(end) {
		t.Fatalf("metadata calls = %d for [%v, %v], want one call for [%v, %v]", mouse.calls, mouse.start, mouse.end, start, end)
	}
}

func TestCollectRunEnvironmentSkipsMetadataForInvalidWindows(t *testing.T) {
	base := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	for _, tt := range []struct {
		name       string
		start, end time.Time
	}{
		{name: "zero start", end: base},
		{name: "zero end", start: base},
		{name: "reversed window", start: base.Add(time.Minute), end: base},
		{name: "empty window", start: base, end: base},
	} {
		t.Run(tt.name, func(t *testing.T) {
			mouse := &collectorTestMouse{metadata: models.MouseRunMetadata{DeviceName: "should not be read"}}
			got := CollectRunEnvironment(mouse, tt.start, tt.end, 3, "", "")
			if mouse.calls != 0 {
				t.Fatalf("metadata calls = %d, want none for an invalid time window", mouse.calls)
			}
			if got.TraceDuration != 0 || got.MouseName != "" || got.SampleRate != int32(constants.DefaultMouseSampleHz) {
				t.Errorf("invalid-window environment = %+v", got)
			}
		})
	}
}

func TestCollectRunEnvironmentUsesDefaultSampleRateAndRejectsInvalidIDs(t *testing.T) {
	start := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	mouse := &collectorTestMouse{metadata: models.MouseRunMetadata{
		Backend: "  ", VendorID: "0x12g4", ProductID: "123", InterfaceNumber: "xyz", SampleRateHz: 0,
	}}
	got := CollectRunEnvironment(mouse, start, start.Add(time.Second), 0, "", "")
	if got.MouseVID != "" || got.MousePID != "" || got.MouseMI != "" {
		t.Errorf("invalid device identifiers were retained: %+v", got)
	}
	if got.MouseBackend != "unknown" || got.SampleRate != int32(constants.DefaultMouseSampleHz) {
		t.Errorf("fallback mouse metadata = %+v", got)
	}
}

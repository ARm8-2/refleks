package runs

import (
	"math"
	"testing"
)

const cm360Tolerance = 0.001 // cm

func TestCm360DirectEntries(t *testing.T) {
	cases := []struct {
		name      string
		scale     string
		horizSens float64
		want      float64
	}{
		{"cm/360 passes through", "cm/360", 30.0, 30.0},
		{"in/360 converts to cm", "in/360", 12.0, 12.0 * 2.54},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := cm360(tc.scale, tc.horizSens, 800)
			if !ok {
				t.Fatalf("expected ok=true, got false")
			}
			if math.Abs(got-tc.want) > cm360Tolerance {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCm360GameScales(t *testing.T) {
	// Expected values are derived from the Kovaak's-published yaw constants.
	// If any of these break, either the yaw map drifted from Kovaak's
	// FovSensConfig.json or the conversion formula was changed.
	cases := []struct {
		scale     string
		horizSens float64
		dpi       float64
		want      float64
	}{
		{"CSGO", 2.0, 800, 25.9773},
		{"Counter-Strike", 1.0, 800, 51.9545},
		{"Apex Legends", 1.6, 800, 32.4716},
		{"Quake/Source", 3.5, 400, 29.6883},
		{"Valorant", 0.44479, 800, 36.7320},
		{"Fortnite", 7.5, 800, 27.4347},
		{"Overwatch", 5.0, 800, 34.6364},
		{"Call of Duty", 6.0, 1600, 14.4318},
		{"Halo", 5.0, 800, 10.2872},
		{"Rust", 1.0, 800, 10.1600},
		{"Marvel Rivals", 50.0, 800, 1.3071},
	}
	for _, tc := range cases {
		t.Run(tc.scale, func(t *testing.T) {
			got, ok := cm360(tc.scale, tc.horizSens, tc.dpi)
			if !ok {
				t.Fatalf("expected ok=true, got false")
			}
			if math.Abs(got-tc.want) > 0.01 {
				t.Fatalf("got %v, want %v (delta %v)", got, tc.want, got-tc.want)
			}
		})
	}
}

func TestCm360UnknownScale(t *testing.T) {
	if _, ok := cm360("NotARealGame", 2.0, 800); ok {
		t.Fatalf("expected ok=false for unknown scale")
	}
	// Empty scale should also fail.
	if _, ok := cm360("", 2.0, 800); ok {
		t.Fatalf("expected ok=false for empty scale")
	}
}

func TestCm360InvalidInputs(t *testing.T) {
	cases := []struct {
		name      string
		scale     string
		horizSens float64
		dpi       float64
	}{
		{"zero sens", "CSGO", 0, 800},
		{"negative sens", "CSGO", -1, 800},
		{"zero dpi", "CSGO", 2.0, 0},
		{"negative dpi", "CSGO", 2.0, -100},
		{"NaN sens", "CSGO", math.NaN(), 800},
		{"+Inf sens", "CSGO", math.Inf(1), 800},
		{"zero direct cm/360", "cm/360", 0, 800},
		{"negative direct in/360", "in/360", -5, 800},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, ok := cm360(tc.scale, tc.horizSens, tc.dpi); ok {
				t.Fatalf("expected ok=false for invalid input")
			}
		})
	}
}

func TestCm360FromStats(t *testing.T) {
	// Mimics a parsed Kovaak's CSV: values come in as strings.
	stats := map[string]any{
		"Sens Scale": "Valorant",
		"Horiz Sens": "0.44479",
		"DPI":        "800",
	}
	got, ok := cm360FromStats(stats)
	if !ok {
		t.Fatalf("expected ok=true, got false")
	}
	if math.Abs(got-36.7320) > 0.01 {
		t.Fatalf("got %v, want ~36.7320", got)
	}

	// Nil and unknown-scale maps should fail.
	if _, ok := cm360FromStats(nil); ok {
		t.Fatalf("expected ok=false for nil stats")
	}
	if _, ok := cm360FromStats(map[string]any{"Sens Scale": "Unknown", "Horiz Sens": "1.0", "DPI": "800"}); ok {
		t.Fatalf("expected ok=false for unknown scale via stats")
	}
}

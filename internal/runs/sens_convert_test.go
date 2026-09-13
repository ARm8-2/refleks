package runs

import (
	"math"
	"testing"

	"refleks/internal/models"
)

func TestCm360(t *testing.T) {
	tests := []struct {
		name  string
		scale string
		horiz float64
		dpi   float64
		want  float64
		ok    bool
	}{
		{"cm/360 passthrough", "cm/360", 30, 800, 30, true},
		{"cm/360 ignores dpi", "cm/360", 30, 0, 30, true},
		{"in/360 converts to cm", "in/360", 10, 800, 25.4, true},
		{"valorant uses yaw constant", "Valorant", 0.5, 800, 32.67581475128645, true},
		{"counter-strike source yaw", "Counter-Strike", 1, 800, 51.95454545454546, true},
		{"overwatch family yaw", "Overwatch", 2, 1600, 43.29545454545454, true},

		{"zero horizontal sens", "cm/360", 0, 800, 0, false},
		{"negative horizontal sens", "cm/360", -1, 800, 0, false},
		{"nan horizontal sens", "cm/360", math.NaN(), 800, 0, false},
		{"zero in/360", "in/360", 0, 800, 0, false},
		{"zero dpi on linear scale", "Valorant", 0.5, 0, 0, false},
		{"unknown scale", "Not A Real Scale", 1, 800, 0, false},
		{"empty scale", "", 1, 800, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := cm360(tt.scale, tt.horiz, tt.dpi)
			if ok != tt.ok {
				t.Fatalf("cm360(%q, %v, %v) ok = %v, want %v", tt.scale, tt.horiz, tt.dpi, ok, tt.ok)
			}
			if ok && math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("cm360(%q, %v, %v) = %v, want %v", tt.scale, tt.horiz, tt.dpi, got, tt.want)
			}
		})
	}
}

func TestCm360FromStats(t *testing.T) {
	stats := models.RunStatsSummary{SensScale: "in/360", HorizSens: 2}
	got, ok := cm360FromStats(stats)
	if !ok || math.Abs(got-5.08) > 1e-9 {
		t.Fatalf("cm360FromStats = (%v, %v), want (5.08, true)", got, ok)
	}
}

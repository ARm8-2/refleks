package sens

import (
	"math"

	"refleks/internal/constants"
	"refleks/internal/util"
)

// Input contains the raw sensitivity information extracted from a stats file.
// Only horizontal sensitivity is considered for conversion.
// Scale examples: "cm/360", "in/360", "CSGO".
// DPI is required for game scale conversions (e.g., CSGO).
//
// We keep this small on purpose; future non-linear scales can use the same
// contract by providing a converter function.
//
// Returned cm/360 is a positive finite value; callers should validate ok.
func Cm360(scale string, horizSens, dpi float64) (cm float64, ok bool) {
	// Direct, strict matching. We assume scale values are consistent.
	switch scale {
	case "cm/360":
		if isFinitePositive(horizSens) {
			return horizSens, true
		}
		return 0, false
	case "in/360":
		if isFinitePositive(horizSens) {
			return horizSens * 2.54, true
		}
		return 0, false
	default:
		// Linear engines using yaw: cm/360 = 360 / (dpi * sens * yaw) * 2.54
		if !isFinitePositive(horizSens) || !isFinitePositive(dpi) {
			return 0, false
		}
		if yaw, ok := yawByScale[scale]; ok && yaw > 0 {
			val := 360.0 / (dpi * horizSens * yaw) * 2.54
			if isFinitePositive(val) {
				return val, true
			}
		}
		return 0, false
	}
}

// Cm360FromStats extracts the needed values from a generic stats map and computes cm/360.
// Expected keys (Kovaak's exports):
//
//	"Sens Scale" (string), "Horiz Sens" (number), "DPI" (number)
//
// Returns (0,false) when not enough information is present or scale unsupported.
func Cm360FromStats(stats map[string]any) (float64, bool) {
	if stats == nil {
		return 0, false
	}
	scale, _ := stats["Sens Scale"].(string)
	s := util.ToFloat(stats["Horiz Sens"]) // treat as horiz sens across scales
	dpi := util.ToFloat(stats["DPI"])
	return Cm360(scale, s, dpi)
}

// Strict mapping from scale value to yaw (deg per count) for supported games.
var yawByScale = map[string]float64{
	"CSGO": constants.YawDegPerCountCSGO,
}

func isFinitePositive(v float64) bool { return !(math.IsNaN(v) || math.IsInf(v, 0) || v <= 0) }

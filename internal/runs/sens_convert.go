package runs

import (
	"math"
	"strconv"
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// cm360 converts horizontal sensitivity data into centimeters per 360-degree turn.
func cm360(scale string, horizSens, dpi float64) (cm float64, ok bool) {
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

// cm360FromStats extracts the needed values from a stats summary and computes cm/360.
func cm360FromStats(stats models.RunStatsSummary) (float64, bool) {
	return cm360(stats.SensScale, stats.HorizSens, stats.DPI)
}

// yawByScale maps Kovaak's "Sens Scale" string to the corresponding yaw
// constant (degrees of rotation per mouse count at sensitivity 1.0).
//
// Values are sourced from Kovaak's official FovSensConfig.json. Only scales
// using a linear IncrementFormula of the form "Sens * yaw" are listed here.
// Non-linear scales (Splitgate, Paladins, PUBG, Battlefield V/1/6, GTA 5)
// depend on FOV or use affine formulas and are intentionally omitted.
var yawByScale = map[string]float64{
	// Source family (yaw 0.022)
	"Quake/Source":    constants.YawDegPerCountSource,
	"Quake Champions": constants.YawDegPerCountSource,
	"Apex Legends":    constants.YawDegPerCountSource,
	"Counter-Strike":  constants.YawDegPerCountSource,
	"CSGO":            constants.YawDegPerCountSource,

	// Overwatch family (yaw 0.0066)
	"Overwatch":    constants.YawDegPerCountOverwatch,
	"Call of Duty": constants.YawDegPerCountOverwatch,
	"Destiny 2":    constants.YawDegPerCountOverwatch,

	// Riot
	"Valorant": constants.YawDegPerCountValorant,

	// Unique scales
	"Halo":              0.022222,
	"Fortnite":          0.005555,
	"Diabotical":        1.0 / 60.0,
	"Rust":              0.1125,
	"UE4":               0.07,
	"Hunt: Showdown":    0.0429718162181364,
	"Gundam Evolution":  0.0003888500001,
	"The FINALS":        0.001,
	"Roblox":            1.01061008,
	"Roblox Arsenal":    0.375,
	"Marvel Rivals":     0.0175,
	"Deadlock":          0.044,
	"Fragpunk":          0.05555,
	"Strinova":          0.01388194363,
	"Delta Force":       0.03,
	"Batallion":         0.017501,
	"Rainbow 6: Siege":  0.018 / math.Pi,
	"Reflex Arena":      0.018 / math.Pi,
}

func toFloat(v any) float64 {
	switch t := v.(type) {
	case int:
		return float64(t)
	case int32:
		return float64(t)
	case int64:
		return float64(t)
	case uint:
		return float64(t)
	case uint32:
		return float64(t)
	case uint64:
		return float64(t)
	case float32:
		return float64(t)
	case float64:
		return t
	case string:
		if f, err := strconv.ParseFloat(strings.TrimSpace(t), 64); err == nil {
			return f
		}
	}
	return 0
}

func isFinitePositive(v float64) bool { return !(math.IsNaN(v) || math.IsInf(v, 0) || v <= 0) }

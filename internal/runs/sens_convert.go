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

var yawByScale = map[string]float64{
	"Apex Legends":   constants.YawDegPerCountSource,
	"CSGO":           constants.YawDegPerCountSource,
	"Counter-Strike": constants.YawDegPerCountSource,
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

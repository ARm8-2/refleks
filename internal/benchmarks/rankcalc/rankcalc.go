package rankcalc

import (
	"math"
	"refleks/internal/models"
)

// UpdateEnergies calculates and assigns energy values to scenarios and/or groups
// based on the benchmark's rank calculation logic.
func UpdateEnergies(kind string, b *models.Benchmark, d *models.BenchmarkDifficulty, categories *[]models.ProgressCategory) {
	switch kind {
	case "ra-s5":
		raS5(categories, b, d)
	case "vt-energy":
		vtEnergy(categories, b, d)
	}
}

// CalculateLinearEnergy computes energy based on linear interpolation between rank thresholds.
// It assumes thresholds are ordered ascending and correspond to energy steps of 100.
// startEnergy is the energy value for the first rank (thresholds[0]).
func CalculateLinearEnergy(score float64, thresholds []float64, startEnergy float64) float64 {
	if score <= 0 {
		return 0
	}

	// The thresholds slice includes a prepended baseline value (see benchmarks.go).
	// We need to skip it to align with the rank definitions.
	if len(thresholds) > 0 {
		thresholds = thresholds[1:]
	}

	n := len(thresholds)
	if n == 0 {
		return 0
	}

	// Case 1: Score is below the first threshold
	if score < thresholds[0] {
		percentage := math.Round((score / thresholds[0]) * 100)
		return startEnergy * 0.01 * percentage
	}

	// Case 2: Score is between thresholds
	for i := 0; i < n-1; i++ {
		lowT := thresholds[i]
		highT := thresholds[i+1]
		lowE := startEnergy + float64(i)*100

		if score < highT {
			fraction := (score - lowT) / (highT - lowT)
			added := math.Round(fraction * 100)
			return lowE + added
		}
	}

	// Case 3: Score is above or equal to the last threshold
	maxEnergy := startEnergy + float64(n-1)*100
	return maxEnergy
}

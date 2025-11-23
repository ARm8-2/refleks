package rankcalc

import (
	"refleks/internal/models"
)

// raS5 implements the energy calculation for Revosect S5.
// It uses the difficulty name to determine the base energy and applies
// linear interpolation between rank thresholds.
func raS5(categories *[]models.ProgressCategory, b *models.Benchmark, d *models.BenchmarkDifficulty) {
	// Determine base energy based on difficulty name
	var baseEnergy float64
	switch d.DifficultyName {
	case "Entry":
		baseEnergy = 100
	case "Intermediate":
		baseEnergy = 500
	case "Advanced":
		baseEnergy = 1000
	default:
		baseEnergy = 100
	}

	for i := range *categories {
		cat := &(*categories)[i]
		for j := range cat.Groups {
			grp := &cat.Groups[j]
			for k := range grp.Scenarios {
				s := &grp.Scenarios[k]
				e := CalculateLinearEnergy(s.Score, s.Thresholds, baseEnergy)
				s.Energy = &e
			}
		}
	}
}

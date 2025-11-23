package rankcalc

import (
	"refleks/internal/models"
)

func vtEnergy(categories *[]models.ProgressCategory, b *models.Benchmark, d *models.BenchmarkDifficulty) {
	// Determine base energy based on difficulty name
	var baseEnergy float64
	switch d.DifficultyName {
	case "Novice":
		baseEnergy = 100
	case "Intermediate":
		baseEnergy = 500
	case "Advanced":
		baseEnergy = 900
	default:
		baseEnergy = 100
	}

	for i := range *categories {
		cat := &(*categories)[i]
		for j := range cat.Groups {
			grp := &cat.Groups[j]

			// Calculate energy for each scenario and find the max
			maxE := 0.0
			for k := range grp.Scenarios {
				s := &grp.Scenarios[k]
				e := CalculateLinearEnergy(s.Score, s.Thresholds, baseEnergy)
				if e > maxE {
					maxE = e
				}
			}

			grp.Energy = &maxE
		}
	}
}

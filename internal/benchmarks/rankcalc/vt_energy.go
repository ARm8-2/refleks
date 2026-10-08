package rankcalc

import (
	"math"

	"refleks/internal/models"
)

// vtEnergy implements Voltaic's energy system: a subcategory's energy is the
// best energy among its scenarios, and the overall energy is the harmonic
// mean of all subcategory energies (so it is 0 until every subcategory has a
// score). The Voltaic rank is derived from that overall energy, which differs
// from KovaaK's OverallRank (every scenario at rank, i.e. "complete").
//
// Energy keeps growing past the top rank's threshold: for Advanced it is
// capped at the top rank's value until the overall energy reaches that rank,
// as documented by Voltaic; for lower difficulties it is capped at the first
// rank of the next difficulty.
func vtEnergy(progress *models.BenchmarkProgress, b *models.Benchmark, d *models.BenchmarkDifficulty) {
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

	rankCount := vtRankCount(progress)
	topRankEnergy := baseEnergy + float64(rankCount-1)*100
	maxEnergy := baseEnergy + float64(rankCount)*100
	if d.DifficultyName == "Advanced" {
		maxEnergy = topRankEnergy
	}

	overall := vtApplyGroupEnergies(progress, baseEnergy, maxEnergy)
	if d.DifficultyName == "Advanced" && rankCount > 0 && overall >= topRankEnergy {
		overall = vtApplyGroupEnergies(progress, baseEnergy, math.Inf(1))
	}

	progress.OverallEnergy = &overall
	progress.EnergyRank = vtEnergyRank(overall, baseEnergy, rankCount)
}

// vtRankCount returns the number of ranks, preferring the rank definitions and
// falling back to the scenario thresholds (which carry a leading baseline).
func vtRankCount(progress *models.BenchmarkProgress) int {
	if len(progress.Ranks) > 0 {
		return len(progress.Ranks)
	}
	for _, cat := range progress.Categories {
		for _, grp := range cat.Groups {
			for _, s := range grp.Scenarios {
				if len(s.Thresholds) > 1 {
					return len(s.Thresholds) - 1
				}
			}
		}
	}
	return 0
}

// vtApplyGroupEnergies sets each group's energy to its best scenario energy
// and returns the harmonic mean over all groups (0 if any group has none).
func vtApplyGroupEnergies(progress *models.BenchmarkProgress, baseEnergy, maxEnergy float64) float64 {
	groups := 0
	sumInverse := 0.0
	missing := false
	for i := range progress.Categories {
		cat := &progress.Categories[i]
		for j := range cat.Groups {
			grp := &cat.Groups[j]

			// Calculate energy for each scenario and find the max
			maxE := 0.0
			for k := range grp.Scenarios {
				s := &grp.Scenarios[k]
				e := vtScenarioEnergy(s.Score, s.Thresholds, baseEnergy, maxEnergy)
				if e > maxE {
					maxE = e
				}
			}

			grp.Energy = &maxE
			groups++
			if maxE <= 0 {
				missing = true
			} else {
				sumInverse += 1 / maxE
			}
		}
	}
	if groups == 0 || missing {
		return 0
	}
	return float64(groups) / sumInverse
}

// vtScenarioEnergy is CalculateLinearEnergy extended past the top threshold:
// above it, energy keeps rising at the pace of the last rank interval, up to
// maxEnergy.
func vtScenarioEnergy(score float64, thresholds []float64, baseEnergy, maxEnergy float64) float64 {
	// Skip the prepended baseline to align with the rank definitions.
	n := len(thresholds) - 1
	if n < 2 || score < thresholds[n] {
		return CalculateLinearEnergy(score, thresholds, baseEnergy)
	}
	gap := thresholds[n] - thresholds[n-1]
	topE := baseEnergy + float64(n-1)*100
	if gap <= 0 {
		return math.Min(topE, maxEnergy)
	}
	e := topE + math.Round((score-thresholds[n])/gap*100)
	return math.Min(e, maxEnergy)
}

// vtEnergyRank returns the 1-based rank reached with the given overall
// energy, where rank i requires baseEnergy + (i-1)*100.
func vtEnergyRank(overall, baseEnergy float64, rankCount int) int {
	if overall < baseEnergy {
		return 0
	}
	rank := int(math.Floor((overall-baseEnergy)/100)) + 1
	if rank > rankCount {
		rank = rankCount
	}
	return rank
}

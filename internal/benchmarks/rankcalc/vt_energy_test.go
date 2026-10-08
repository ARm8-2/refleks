package rankcalc

import (
	"math"
	"testing"

	"refleks/internal/models"
)

// vtThresholds mirrors parser output: a prepended baseline followed by one
// threshold per rank (Iron/Bronze/Silver/Gold for Novice).
var vtThresholds = []float64{0, 100, 200, 300, 400}

// vtProgress builds a progress model with one group per score; each group
// holds a single scenario so the group energy equals that scenario's energy.
func vtProgress(scores ...float64) *models.BenchmarkProgress {
	groups := make([]models.ProgressGroup, len(scores))
	for i, score := range scores {
		groups[i] = models.ProgressGroup{
			Scenarios: []models.ScenarioProgress{{Score: score, Thresholds: vtThresholds}},
		}
	}
	return &models.BenchmarkProgress{
		Ranks:      make([]models.RankDef, 4),
		Categories: []models.ProgressCategory{{Groups: groups}},
	}
}

func groupEnergies(p *models.BenchmarkProgress) []float64 {
	var out []float64
	for _, cat := range p.Categories {
		for _, grp := range cat.Groups {
			if grp.Energy == nil {
				out = append(out, math.NaN())
				continue
			}
			out = append(out, *grp.Energy)
		}
	}
	return out
}

func approxEqual(a, b float64) bool { return math.Abs(a-b) < 0.01 }

func TestVTEnergyOverallIsHarmonicMeanOfGroups(t *testing.T) {
	// Two subcategories above Gold and one at Silver+60: every subcategory is
	// not Gold ("Silver complete"), but the harmonic mean still reaches Gold.
	p := vtProgress(450, 450, 360)
	UpdateEnergies("vt-energy", nil, &models.BenchmarkDifficulty{DifficultyName: "Novice"}, p)

	wantGroups := []float64{450, 450, 360}
	for i, got := range groupEnergies(p) {
		if !approxEqual(got, wantGroups[i]) {
			t.Errorf("group %d energy = %v, want %v", i, got, wantGroups[i])
		}
	}
	wantOverall := 3 / (1/450.0 + 1/450.0 + 1/360.0)
	if p.OverallEnergy == nil || !approxEqual(*p.OverallEnergy, wantOverall) {
		t.Fatalf("overall energy = %v, want %v", p.OverallEnergy, wantOverall)
	}
	if p.EnergyRank != 4 {
		t.Errorf("energy rank = %d, want 4 (Gold)", p.EnergyRank)
	}
}

func TestVTEnergyMissingSubcategoryGivesNoEnergy(t *testing.T) {
	p := vtProgress(450, 450, 0)
	UpdateEnergies("vt-energy", nil, &models.BenchmarkDifficulty{DifficultyName: "Novice"}, p)

	if p.OverallEnergy == nil || *p.OverallEnergy != 0 {
		t.Fatalf("overall energy = %v, want 0", p.OverallEnergy)
	}
	if p.EnergyRank != 0 {
		t.Errorf("energy rank = %d, want 0", p.EnergyRank)
	}
}

func TestVTEnergyRankBelowFirstThreshold(t *testing.T) {
	p := vtProgress(80, 80, 80)
	UpdateEnergies("vt-energy", nil, &models.BenchmarkDifficulty{DifficultyName: "Novice"}, p)

	if p.OverallEnergy == nil || !approxEqual(*p.OverallEnergy, 80) {
		t.Fatalf("overall energy = %v, want 80", p.OverallEnergy)
	}
	if p.EnergyRank != 0 {
		t.Errorf("energy rank = %d, want 0", p.EnergyRank)
	}
}

func TestVTEnergyEachRankBoundary(t *testing.T) {
	for rank, score := range map[int]float64{1: 100, 2: 250, 3: 300, 4: 400} {
		p := vtProgress(score, score, score)
		UpdateEnergies("vt-energy", nil, &models.BenchmarkDifficulty{DifficultyName: "Novice"}, p)
		if p.EnergyRank != rank {
			t.Errorf("score %v: energy rank = %d, want %d", score, p.EnergyRank, rank)
		}
	}
}

func TestVTEnergyNoviceAboveTopRankCapsAtNextTier(t *testing.T) {
	p := vtProgress(1000, 450, 450)
	UpdateEnergies("vt-energy", nil, &models.BenchmarkDifficulty{DifficultyName: "Novice"}, p)

	if got := groupEnergies(p)[0]; !approxEqual(got, 500) {
		t.Errorf("capped group energy = %v, want 500", got)
	}
	if p.EnergyRank != 4 {
		t.Errorf("energy rank = %d, want 4 (top rank)", p.EnergyRank)
	}
}

func TestVTEnergyAdvancedCappedUntilTopRankReached(t *testing.T) {
	adv := &models.BenchmarkDifficulty{DifficultyName: "Advanced"}

	// Overall below Celestial (1200): the strong subcategory stays capped.
	p := vtProgress(600, 350, 350)
	UpdateEnergies("vt-energy", nil, adv, p)
	if got := groupEnergies(p)[0]; !approxEqual(got, 1200) {
		t.Errorf("capped advanced group energy = %v, want 1200", got)
	}
	if p.EnergyRank != 3 {
		t.Errorf("energy rank = %d, want 3 (Astra)", p.EnergyRank)
	}

	// Overall reaches Celestial with capped energies: energies are uncapped.
	p = vtProgress(450, 450, 600)
	UpdateEnergies("vt-energy", nil, adv, p)
	want := []float64{1250, 1250, 1400}
	for i, got := range groupEnergies(p) {
		if !approxEqual(got, want[i]) {
			t.Errorf("uncapped group %d energy = %v, want %v", i, got, want[i])
		}
	}
	if p.EnergyRank != 4 {
		t.Errorf("energy rank = %d, want 4 (Celestial)", p.EnergyRank)
	}
}

func TestRaS5LeavesOverallEnergyUnset(t *testing.T) {
	p := vtProgress(450, 450, 450)
	UpdateEnergies("ra-s5", nil, &models.BenchmarkDifficulty{DifficultyName: "Entry"}, p)

	if p.OverallEnergy != nil || p.EnergyRank != 0 {
		t.Errorf("ra-s5 set overall energy/rank: %v / %d", p.OverallEnergy, p.EnergyRank)
	}
	// ra-s5 keeps the existing cap at the top rank's energy.
	if e := p.Categories[0].Groups[0].Scenarios[0].Energy; e == nil || !approxEqual(*e, 400) {
		t.Errorf("ra-s5 scenario energy = %v, want 400", e)
	}
}

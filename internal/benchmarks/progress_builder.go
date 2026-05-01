package benchmarks

import (
	"strings"

	"refleks/internal/benchmarks/rankcalc"
	"refleks/internal/models"
)

func (s *Service) buildStructuredProgress(raw string, benchmarkID int) (models.BenchmarkProgress, error) {
	var out models.BenchmarkProgress

	scenarios, ranks, overallRank, benchmarkProgress, err := parseProgressTokens(raw)
	if err != nil {
		return out, err
	}

	benchmark, difficulty := s.findDifficultyByBenchmarkID(benchmarkID)

	if fromBenchmark := rankDefsFromDifficulty(difficulty); len(fromBenchmark) > 0 {
		out.Ranks = fromBenchmark
	} else {
		out.Ranks = mergeRankDefs(ranks)
	}
	out.OverallRank = overallRank
	out.BenchmarkProgress = benchmarkProgress
	out.Categories = groupScenariosByMeta(scenarios, difficulty)

	if benchmark != nil {
		rankcalc.UpdateEnergies(benchmark.RankCalculation, benchmark, difficulty, &out.Categories)
	}

	return out, nil
}

func (s *Service) findDifficultyByBenchmarkID(benchmarkID int) (*models.Benchmark, *models.BenchmarkDifficulty) {
	list, err := s.GetBenchmarks()
	if err != nil {
		return nil, nil
	}

	for i := range list {
		benchmark := &list[i]
		for j := range benchmark.Difficulties {
			difficulty := &benchmark.Difficulties[j]
			if difficulty.KovaaksBenchmarkID == benchmarkID {
				return benchmark, difficulty
			}
		}
	}
	return nil, nil
}

func rankDefsFromDifficulty(difficulty *models.BenchmarkDifficulty) []models.RankDef {
	if difficulty == nil || len(difficulty.Ranks) == 0 {
		return nil
	}

	defs := make([]models.RankDef, 0, len(difficulty.Ranks))
	for _, rank := range difficulty.Ranks {
		name := strings.TrimSpace(rank.Name)
		if strings.EqualFold(name, "no rank") || name == "" {
			continue
		}

		color := strings.TrimSpace(rank.Color)
		if color == "" {
			color = "#60a5fa"
		}

		defs = append(defs, models.RankDef{Name: name, Color: color})
	}

	return defs
}

func mergeRankDefs(ranks []rawRank) []models.RankDef {
	defs := make([]models.RankDef, 0, len(ranks))

	for _, rank := range ranks {
		name := strings.TrimSpace(rank.Name)
		if strings.EqualFold(name, "no rank") || name == "" {
			continue
		}
		color := strings.TrimSpace(rank.Color)
		if color == "" {
			color = "#60a5fa"
		}
		defs = append(defs, models.RankDef{Name: name, Color: color})
	}

	return defs
}

func groupScenariosByMeta(scenarios []models.ScenarioProgress, difficulty *models.BenchmarkDifficulty) []models.ProgressCategory {
	categories := []models.ProgressCategory{}
	pos := 0
	if difficulty == nil || len(difficulty.Categories) == 0 {
		group := models.ProgressGroup{Scenarios: make([]models.ScenarioProgress, 0, len(scenarios))}
		group.Scenarios = append(group.Scenarios, scenarios...)
		categories = append(categories, models.ProgressCategory{Name: "", Color: "", Groups: []models.ProgressGroup{group}})
		return categories
	}

	for categoryIndex, category := range difficulty.Categories {
		progressCategory := models.ProgressCategory{Name: category.CategoryName, Color: category.Color}
		groups := make([]models.ProgressGroup, 0, len(category.Subcategories))
		for _, subcategory := range category.Subcategories {
			take := subcategory.ScenarioCount
			if take < 0 {
				take = 0
			}
			end := pos + take
			if end > len(scenarios) {
				end = len(scenarios)
			}
			group := models.ProgressGroup{Name: subcategory.SubcategoryName, Color: subcategory.Color}
			if end > pos {
				group.Scenarios = append(group.Scenarios, scenarios[pos:end]...)
			}
			pos = end
			groups = append(groups, group)
		}
		if categoryIndex == len(difficulty.Categories)-1 && pos < len(scenarios) {
			group := models.ProgressGroup{}
			group.Scenarios = append(group.Scenarios, scenarios[pos:]...)
			pos = len(scenarios)
			groups = append(groups, group)
		}
		progressCategory.Groups = groups
		categories = append(categories, progressCategory)
	}

	return categories
}

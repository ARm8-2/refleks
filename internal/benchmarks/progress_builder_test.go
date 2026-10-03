package benchmarks

import (
	"reflect"
	"testing"

	"refleks/internal/models"
)

func TestGroupScenariosByMetaPreservesOrderAndLeftovers(t *testing.T) {
	scenarios := []models.ScenarioProgress{
		{Name: "First", Score: 1}, {Name: "Second", Score: 2}, {Name: "Third", Score: 3},
	}
	difficulty := &models.BenchmarkDifficulty{Categories: []models.BenchmarkCategory{
		{
			CategoryName: "Clicking", Color: "red",
			Subcategories: []models.BenchmarkSubcategory{
				{SubcategoryName: "Static", Color: "blue", ScenarioCount: 1},
			},
		},
		{
			CategoryName: "Tracking", Color: "green",
			Subcategories: []models.BenchmarkSubcategory{
				{SubcategoryName: "Smooth", Color: "yellow", ScenarioCount: 1},
			},
		},
	}}
	want := []models.ProgressCategory{
		{Name: "Clicking", Color: "red", Groups: []models.ProgressGroup{
			{Name: "Static", Color: "blue", Scenarios: scenarios[:1]},
		}},
		{Name: "Tracking", Color: "green", Groups: []models.ProgressGroup{
			{Name: "Smooth", Color: "yellow", Scenarios: scenarios[1:2]},
			{Scenarios: scenarios[2:]},
		}},
	}
	got := groupScenariosByMeta(scenarios, difficulty)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("grouped scenarios = %+v, want %+v", got, want)
	}
	got[0].Groups[0].Scenarios[0].Name = "Changed"
	if scenarios[0].Name != "First" {
		t.Error("grouping should copy scenario structs instead of aliasing the input slice")
	}
}

func TestGroupScenariosByMetaHandlesMismatchedCounts(t *testing.T) {
	scenarios := []models.ScenarioProgress{{Name: "First"}, {Name: "Second"}}
	difficulty := &models.BenchmarkDifficulty{Categories: []models.BenchmarkCategory{{
		Subcategories: []models.BenchmarkSubcategory{
			{SubcategoryName: "Negative", ScenarioCount: -1},
			{SubcategoryName: "Zero", ScenarioCount: 0},
			{SubcategoryName: "Too many", ScenarioCount: 10},
			{SubcategoryName: "Exhausted", ScenarioCount: 1},
		},
	}}}
	want := []models.ProgressCategory{{Groups: []models.ProgressGroup{
		{Name: "Negative"}, {Name: "Zero"},
		{Name: "Too many", Scenarios: scenarios}, {Name: "Exhausted"},
	}}}
	if got := groupScenariosByMeta(scenarios, difficulty); !reflect.DeepEqual(got, want) {
		t.Errorf("grouped scenarios = %+v, want %+v", got, want)
	}
}

func TestGroupScenariosWithoutMetadataUsesSingleGroup(t *testing.T) {
	for _, difficulty := range []*models.BenchmarkDifficulty{nil, {}} {
		for _, scenarios := range [][]models.ScenarioProgress{nil, {{Name: "First"}, {Name: "Second"}}} {
			got := groupScenariosByMeta(scenarios, difficulty)
			if len(got) != 1 || len(got[0].Groups) != 1 {
				t.Fatalf("grouped scenarios = %+v, want a single category/group", got)
			}
			group := got[0].Groups[0]
			if group.Scenarios == nil || len(group.Scenarios) != len(scenarios) {
				t.Errorf("group scenarios = %v, want non-nil slice with %d scenarios", group.Scenarios, len(scenarios))
			}
			for i := range scenarios {
				if !reflect.DeepEqual(group.Scenarios[i], scenarios[i]) {
					t.Errorf("scenario %d = %+v, want %+v", i, group.Scenarios[i], scenarios[i])
				}
			}
		}
	}
}

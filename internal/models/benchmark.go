package models

type Benchmark struct {
	BenchmarkName   string                `json:"benchmarkName"`
	RankCalculation string                `json:"rankCalculation"`
	Abbreviation    string                `json:"abbreviation"`
	Color           string                `json:"color"`
	SpreadsheetURL  string                `json:"spreadsheetURL"`
	Difficulties    []BenchmarkDifficulty `json:"difficulties"`
}

type BenchmarkDifficulty struct {
	DifficultyName     string              `json:"difficultyName"`
	KovaaksBenchmarkID int                 `json:"kovaaksBenchmarkId"`
	Sharecode          string              `json:"sharecode"`
	RankColors         map[string]string   `json:"rankColors"`
	Categories         []BenchmarkCategory `json:"categories"`
}

type BenchmarkCategory struct {
	CategoryName  string                 `json:"categoryName"`
	Color         string                 `json:"color,omitempty"`
	Subcategories []BenchmarkSubcategory `json:"subcategories"`
}

type BenchmarkSubcategory struct {
	SubcategoryName string `json:"subcategoryName"`
	ScenarioCount   int    `json:"scenarioCount"`
	Color           string `json:"color,omitempty"`
}

type RankDef struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type ScenarioProgress struct {
	Name         string    `json:"name"`
	Score        float64   `json:"score"`
	ScenarioRank int       `json:"scenarioRank"`
	Thresholds   []float64 `json:"thresholds"`
}

type ProgressGroup struct {
	Name      string             `json:"name,omitempty"`
	Color     string             `json:"color,omitempty"`
	Scenarios []ScenarioProgress `json:"scenarios"`
}

type ProgressCategory struct {
	Name   string          `json:"name"`
	Color  string          `json:"color,omitempty"`
	Groups []ProgressGroup `json:"groups"`
}

type BenchmarkProgress struct {
	OverallRank       int                `json:"overallRank"`
	BenchmarkProgress float64            `json:"benchmarkProgress"`
	Ranks             []RankDef          `json:"ranks"`
	Categories        []ProgressCategory `json:"categories"`
}

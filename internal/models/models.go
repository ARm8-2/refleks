package models

import "time"

// ScenarioRecord is the canonical record shape exchanged over IPC.
type ScenarioRecord struct {
	FilePath string         `json:"filePath"`
	FileName string         `json:"fileName"`
	Stats    map[string]any `json:"stats"`
	Events   [][]string     `json:"events"`
	// Optional mouse trace captured locally. Absent when disabled or unavailable.
	MouseTrace []MousePoint `json:"mouseTrace,omitempty"`
}

// WatcherConfig contains runtime configuration for the watcher.
type WatcherConfig struct {
	Path                 string
	SessionGap           time.Duration
	PollInterval         time.Duration
	ParseExistingOnStart bool
	ParseExistingLimit   int
}

// Settings represents persisted application settings.
type Settings struct {
	SteamInstallDir      string   `json:"steamInstallDir"`
	StatsDir             string   `json:"statsDir"`
	TracesDir            string   `json:"tracesDir"`
	SessionGapMinutes    int      `json:"sessionGapMinutes"`
	Theme                string   `json:"theme"`
	FavoriteBenchmarks   []string `json:"favoriteBenchmarks,omitempty"`
	MouseTrackingEnabled bool     `json:"mouseTrackingEnabled"`
	MouseBufferMinutes   int      `json:"mouseBufferMinutes"`
	MaxExistingOnStart   int      `json:"maxExistingOnStart"`
}

// Benchmark models exposed to frontend via Wails
type Benchmark struct {
	BenchmarkName   string                `json:"benchmarkName"`
	RankCalculation string                `json:"rankCalculation"`
	Abbreviation    string                `json:"abbreviation"`
	Color           string                `json:"color"`
	SpreadsheetURL  string                `json:"spreadsheetURL"`
	Difficulties    []BenchmarkDifficulty `json:"difficulties"`
}

type BenchmarkDifficulty struct {
	DifficultyName     string            `json:"difficultyName"`
	KovaaksBenchmarkID int               `json:"kovaaksBenchmarkId"`
	Sharecode          string            `json:"sharecode"`
	RankColors         map[string]string `json:"rankColors"`
	Categories         []map[string]any  `json:"categories"`
}

// MousePoint is a single mouse position sample with a timestamp.
type MousePoint struct {
	TS time.Time `json:"ts"`
	X  int32     `json:"x"`
	Y  int32     `json:"y"`
}

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
	SteamInstallDir string `json:"steamInstallDir"`
	// SteamIDOverride, if set, forces the SteamID used for Kovaak's API calls instead of parsing loginusers.vdf.
	SteamIDOverride      string   `json:"steamIdOverride,omitempty"`
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
	DifficultyName     string              `json:"difficultyName"`
	KovaaksBenchmarkID int                 `json:"kovaaksBenchmarkId"`
	Sharecode          string              `json:"sharecode"`
	RankColors         map[string]string   `json:"rankColors"`
	Categories         []BenchmarkCategory `json:"categories"`
}

// Typed benchmark structure (replaces loosely-typed maps)
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

// MousePoint is a single mouse position sample with a timestamp.
type MousePoint struct {
	TS time.Time `json:"ts"`
	X  int32     `json:"x"`
	Y  int32     `json:"y"`
	// Buttons is a bitmask representing which mouse buttons are currently held down.
	// Bits: 1=Left, 2=Right, 4=Middle, 8=Button4, 16=Button5
	Buttons int32 `json:"buttons,omitempty"`
}

// UpdateInfo describes application update availability and metadata exchanged over IPC.
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	// Direct URL to download the installer for the current OS (Windows only for now)
	DownloadURL string `json:"downloadUrl,omitempty"`
	// Optional plain-text notes (best-effort, may be empty)
	ReleaseNotes string `json:"releaseNotes,omitempty"`
}

// --- Structured Benchmark Progress (server-computed) ---

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

package models

// Settings represents persisted application settings.
type Settings struct {
	SteamInstallDir      string                  `json:"steamInstallDir"`
	SteamIDOverride      string                  `json:"steamIdOverride,omitempty"`
	StatsDir             string                  `json:"statsDir"`
	TracesDir            string                  `json:"tracesDir"`
	SessionGapMinutes    int                     `json:"sessionGapMinutes"`
	Theme                string                  `json:"theme"`
	FavoriteBenchmarks   []string                `json:"favoriteBenchmarks,omitempty"`
	MouseTrackingEnabled bool                    `json:"mouseTrackingEnabled"`
	MouseBufferMinutes   int                     `json:"mouseBufferMinutes"`
	MaxExistingOnStart   int                     `json:"maxExistingOnStart"`
	GeminiAPIKey         string                  `json:"geminiApiKey,omitempty"`
	ScenarioNotes        map[string]ScenarioNote `json:"scenarioNotes,omitempty"`
}

// ScenarioNote holds user notes and sensitivity for a scenario.
type ScenarioNote struct {
	Notes string `json:"notes"`
	Sens  string `json:"sens"`
}

package models

// Settings represents persisted application settings.
type Settings struct {
	SteamInstallDir      string                  `json:"steamInstallDir"`
	SteamIDOverride      string                  `json:"steamIdOverride,omitempty"`
	PersonaNameOverride  string                  `json:"personaNameOverride,omitempty"`
	StatsDir             string                  `json:"statsDir"`
	SessionGapMinutes    int                     `json:"sessionGapMinutes"`
	RecentRunsDays       int                     `json:"recentRunsDays"`
	RecentRunsMinCount   int                     `json:"recentRunsMinCount"`
	Theme                string                  `json:"theme"`
	Font                 string                  `json:"font,omitempty"`
	FavoriteBenchmarks   []string                `json:"favoriteBenchmarks,omitempty"`
	MouseTrackingEnabled bool                    `json:"mouseTrackingEnabled"`
	MouseBufferMinutes   int                     `json:"mouseBufferMinutes"`
	AutostartEnabled     bool                    `json:"autostartEnabled"`
	AnonymousEnabled     bool                    `json:"anonymousEnabled"`
	RunSyncEnabled       bool                    `json:"runSyncEnabled"`
	ScenarioNotes        map[string]ScenarioNote `json:"scenarioNotes,omitempty"`
	SessionNotes         map[string]SessionNote  `json:"sessionNotes,omitempty"`
}

// ScenarioNote holds user notes and sensitivity for a scenario.
type ScenarioNote struct {
	Notes string `json:"notes"`
	Sens  string `json:"sens"`
}

// SessionNote holds user notes and name for a session.
type SessionNote struct {
	Name  string `json:"name"`
	Notes string `json:"notes"`
}

package models

type ScenarioRecord struct {
	FilePath string         `json:"filePath"`
	FileName string         `json:"fileName"`
	Stats    map[string]any `json:"stats"`
	Events   [][]string     `json:"events"`
	// Optional mouse trace captured locally. Absent when disabled or unavailable.
	// Deprecated: Use TraceData (base64 binary) for performance.
	MouseTrace []MousePoint `json:"mouseTrace,omitempty"`
	// TraceData is the base64-encoded binary representation of the mouse trace.
	// Format: [Count:4][TS:8][X:4][Y:4][Buttons:4]...
	// Note: This is now loaded lazily. Use HasTrace to check availability.
	TraceData string `json:"traceData,omitempty"`
	// HasTrace indicates if a trace file exists on disk for this scenario.
	HasTrace bool `json:"hasTrace"`
}

type MousePoint struct {
	TS int64 `json:"ts"` // UnixMilli
	X  int32 `json:"x"`
	Y  int32 `json:"y"`
	// Buttons is a bitmask representing which mouse buttons are currently held down.
	// Bits: 1=Left, 2=Right, 4=Middle, 8=Button4, 16=Button5
	Buttons int32 `json:"buttons,omitempty"`
}

type KovaaksLastScore struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Attributes KovaaksScoreAttributes `json:"attributes"`
}

type KovaaksScoreAttributes struct {
	Fov            float64 `json:"fov"`
	Hash           string  `json:"hash"`
	Cm360          float64 `json:"cm360"`
	Kills          int     `json:"kills"`
	Score          float64 `json:"score"`
	AvgFps         float64 `json:"avgFps"`
	AvgTtk         float64 `json:"avgTtk"`
	FovScale       string  `json:"fovScale"`
	VertSens       float64 `json:"vertSens"`
	HorizSens      float64 `json:"horizSens"`
	Resolution     string  `json:"resolution"`
	SensScale      string  `json:"sensScale"`
	PauseCount     int     `json:"pauseCount"`
	PauseDuration  int     `json:"pauseDuration"`
	AccuracyDamage int     `json:"accuracyDamage"`
	ChallengeStart string  `json:"challengeStart"`
	// ModelOverrides omitted for simplicity unless needed
	ScenarioVersion    string `json:"scenarioVersion"`
	ClientBuildVersion string `json:"clientBuildVersion"`
	Epoch              string `json:"epoch"`
}

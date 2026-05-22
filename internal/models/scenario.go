package models

type RunRecord struct {
	FileVersion  uint8               `json:"fileVersion"`
	FilePath     string              `json:"filePath"`
	FileName     string              `json:"fileName"`
	Stats        map[string]any      `json:"stats"`
	Performances *RunPerformanceData `json:"performances,omitempty"`
	Env          RunEnvironment      `json:"env"`
}

type RunPerformanceData struct {
	Header RunPerformanceHeader  `json:"header"`
	Events []RunPerformanceEvent `json:"events,omitempty"`
}

type RunPerformanceHeader struct {
	ScenarioName      string                   `json:"scenarioName"`
	ScenarioHash      string                   `json:"scenarioHash"`
	ChallengeStartUTC int64                    `json:"challengeStartUtc"`
	SchemaVersion     uint32                   `json:"schemaVersion"`
	ChallengeProfile  ChallengeProfileSnapshot `json:"challengeProfile"`
}

type ChallengeProfileSnapshot struct {
	TimeLimit               float32  `json:"timeLimit"`
	PlayerProfile           string   `json:"playerProfile"`
	AddedBots               []string `json:"addedBots"`
	PlayerMaxLives          int32    `json:"playerMaxLives"`
	BotMaxLives             []int32  `json:"botMaxLives"`
	PlayerTeam              int32    `json:"playerTeam"`
	BotTeams                []int32  `json:"botTeams"`
	MapName                 string   `json:"mapName"`
	MapScale                float32  `json:"mapScale"`
	Timescale               float32  `json:"timescale"`
	EndChallengeAfterKills  float32  `json:"endChallengeAfterKills"`
	EndChallengeAfterDamage float32  `json:"endChallengeAfterDamage"`
}

type RunPerformanceEvent struct {
	Timestamp   float32  `json:"timestamp"`
	PayloadType string   `json:"payloadType"`
	Count       *int32   `json:"count,omitempty"`
	Delta       *float32 `json:"delta,omitempty"`
	Value       *float32 `json:"value,omitempty"`
}

type RunEnvironment struct {
	AppVersion  string `json:"appVersion"`
	OS          string `json:"os"`
	Arch        string `json:"arch"`
	OSVersion   string `json:"osVersion"`
	SteamID     string `json:"steamId"`
	PersonaName string `json:"personaName"`

	CPUName    string `json:"cpuName"`
	CPUCores   int32  `json:"cpuCores"`
	GPUName    string `json:"gpuName"`
	RAMTotalMB int32  `json:"ramTotalMB"`

	DisplayHz    float64 `json:"displayHz"`
	ScreenWidth  int32   `json:"screenWidth"`
	ScreenHeight int32   `json:"screenHeight"`
	IsWindowed   bool    `json:"isWindowed"`

	MouseName    string `json:"mouseName"`
	MouseVID     string `json:"mouseVid"`
	MousePID     string `json:"mousePid"`
	MouseMI      string `json:"mouseMi"`
	MouseBackend string `json:"mouseBackend"`

	TracePoints   int32   `json:"tracePoints"`
	TraceDuration float64 `json:"traceDuration"`
	SampleRate    int32   `json:"sampleRate"`
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

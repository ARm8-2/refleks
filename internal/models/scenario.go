package models

type RunRecord struct {
	FileVersion  uint8               `json:"fileVersion"`
	FilePath     string              `json:"filePath"`
	FileName     string              `json:"fileName"`
	Stats        RunStatsData        `json:"stats"`
	Performances *RunPerformanceData `json:"performances,omitempty"`
	Env          RunEnvironment      `json:"env"`
}

type RunStatsData struct {
	Summary RunStatsSummary `json:"summary"`
	Events  []RunStatsEvent `json:"events,omitempty"`
}

type RunStatsSummary struct {
	Score            float64 `json:"score"`
	Kills            int32   `json:"kills"`
	Deaths           int32   `json:"deaths"`
	FightTime        float64 `json:"fightTime"`
	TimeRemaining    float64 `json:"timeRemaining"`
	AvgTTK           float64 `json:"avgTtk"`
	DamageDone       float64 `json:"damageDone"`
	TotalOvershots   int32   `json:"totalOvershots"`
	DamageTaken      float64 `json:"damageTaken"`
	HitCount         int32   `json:"hitCount"`
	MissCount        int32   `json:"missCount"`
	Midairs          int32   `json:"midairs"`
	Midaired         int32   `json:"midaired"`
	Directs          int32   `json:"directs"`
	Directed         int32   `json:"directed"`
	Reloads          int32   `json:"reloads"`
	DistanceTraveled float64 `json:"distanceTraveled"`
	MBSPoints        float64 `json:"mbsPoints"`
	Scenario         string  `json:"scenario"`
	Hash             string  `json:"hash"`
	GameVersion      string  `json:"gameVersion"`
	ChallengeStart   string  `json:"challengeStart"`
	PauseCount       int32   `json:"pauseCount"`
	PauseDuration    float64 `json:"pauseDuration"`
	AvgTargetScale   float64 `json:"avgTargetScale"`
	AvgTimeDilation  float64 `json:"avgTimeDilation"`
	InputLag         float64 `json:"inputLag"`
	MaxFPSConfig     float64 `json:"maxFpsConfig"`
	SensScale        string  `json:"sensScale"`
	SensIncrement    float64 `json:"sensIncrement"`
	HorizSens        float64 `json:"horizSens"`
	VertSens         float64 `json:"vertSens"`
	DPI              float64 `json:"dpi"`
	FOV              float64 `json:"fov"`
	FOVScale         string  `json:"fovScale"`
	HideGun          bool    `json:"hideGun"`
	Crosshair        string  `json:"crosshair"`
	CrosshairScale   float64 `json:"crosshairScale"`
	CrosshairColor   string  `json:"crosshairColor"`
	Resolution       string  `json:"resolution"`
	AvgFPS           float64 `json:"avgFps"`
	ResolutionScale  float64 `json:"resolutionScale"`
	DatePlayed       string  `json:"datePlayed"`
	Accuracy         float64 `json:"accuracy"`
	RealAvgTTK       float64 `json:"realAvgTtk"`
	Cm360            float64 `json:"cm360"`
	Duration         float64 `json:"duration"`
	ScenarioTime     float64 `json:"scenarioTime"`
	Time             float64 `json:"time"`
}

type RunStatsEvent struct {
	KillIndex      int32   `json:"killIndex"`
	Timestamp      string  `json:"timestamp"`
	Bot            string  `json:"bot"`
	Weapon         string  `json:"weapon"`
	TTKSeconds     float64 `json:"ttkSeconds"`
	Shots          int32   `json:"shots"`
	Hits           int32   `json:"hits"`
	Accuracy       float64 `json:"accuracy"`
	DamageDone     float64 `json:"damageDone"`
	DamagePossible float64 `json:"damagePossible"`
	Efficiency     float64 `json:"efficiency"`
	Cheated        bool    `json:"cheated"`
	OverShots      int32   `json:"overShots"`
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

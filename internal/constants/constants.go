package constants

// Centralized constants for internal services. These are not user-editable and
// should not be persisted to disk. Keep magic strings and URLs here.

const (
	// Kovaaks player progress endpoint. Use fmt.Sprintf with benchmarkId and steamId.
	KovaaksPlayerProgressURL = "https://kovaaks.com/webapp-backend/benchmarks/player-progress-rank-benchmark?benchmarkId=%d&steamId=%s"
	// DefaultRecentCap bounds how many recent scenarios we retain in memory when
	// no explicit limit is set in configuration.
	DefaultRecentCap = 500

	// Default UI/analysis values
	DefaultSessionGapMinutes  = 30
	DefaultTheme              = "dark"
	DefaultMouseBufferMinutes = 10
	DefaultMaxExistingOnStart = 500

	// Watcher defaults
	DefaultPollIntervalSeconds = 5

	// Mouse tracking defaults
	DefaultMouseSampleHz = 125

	// Kovaak's Steam App information
	KovaaksSteamAppID = 824270

	// Settings + paths
	// Name of the app config folder in the user's home directory
	ConfigDirName    = ".refleks"
	TracesSubdirName = "traces"

	// Default Kovaak's stats directory on Windows
	DefaultWindowsKovaaksStatsDir = `C:\\Program Files (x86)\\Steam\\steamapps\\common\\FPSAimTrainer\\FPSAimTrainer\\stats`

	// Default Steam install directory (used to locate config/loginusers.vdf)
	DefaultWindowsSteamInstallDir = `C:\\Program Files (x86)\\Steam`

	// Environment variable names
	// If set, this overrides SteamID detection from loginusers.vdf
	EnvSteamIDVar = "REFLEKS_STEAM_ID"
	// If set, this overrides the default stats directory (useful in dev containers)
	EnvStatsDirVar = "REFLEKS_STATS_DIR"
)

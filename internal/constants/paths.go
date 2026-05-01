package constants

const (
	// Settings + paths
	// Name of the app config folder in the user's home directory
	ConfigDirName  = ".refleks"
	RunsSubdirName = "runs"
	RunFileExt     = ".refleks"
	StatsFileExt   = ".csv"

	// Default Kovaak's stats directory on Windows
	DefaultWindowsKovaaksStatsDir = `C:\\Program Files (x86)\\Steam\\steamapps\\common\\FPSAimTrainer\\FPSAimTrainer\\stats`

	// Default Steam install directory (used to locate config/loginusers.vdf)
	DefaultWindowsSteamInstallDir = `C:\\Program Files (x86)\\Steam`

	// Environment variable names
	// If set, this overrides SteamID detection from loginusers.vdf
	EnvSteamIDVar = "REFLEKS_STEAM_ID"
	// If set, this overrides PersonaName detection from loginusers.vdf
	EnvPersonaNameVar = "REFLEKS_PERSONA_NAME"
	// If set, this overrides the default stats directory (useful in dev containers)
	EnvStatsDirVar = "REFLEKS_STATS_DIR"
	// If set, this overrides the default run sync API endpoint.
	EnvRunsSyncURLVar = "REFLEKS_RUNS_SYNC_URL"
	// If set, this overrides the default benchmarks API endpoint.
	EnvBenchmarksURLVar = "REFLEKS_BENCHMARKS_URL"

	// Conventional, explicit filename for release assets. Keep in sync with build/windows/installer/project.nsi
	// Result example: "refleks-0.3.0-windows-amd64-installer.exe"
	WindowsInstallerNameFmt = "refleks-%s-windows-amd64-installer.exe"

	// Cache file names
	BenchmarksDataCacheFileName    = "benchmarks.json"
	BenchmarkProgressCacheFileName = "benchmark_progress.json"
	SettingsFileName               = "settings.json"
)

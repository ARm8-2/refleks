package constants

const (
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
	// If set, this overrides PersonaName detection from loginusers.vdf
	EnvPersonaNameVar = "REFLEKS_PERSONA_NAME"
	// If set, this overrides the default stats directory (useful in dev containers)
	EnvStatsDirVar = "REFLEKS_STATS_DIR"
	// If set, this overrides the stored Gemini API key for AI insights
	EnvGeminiAPIKeyVar = "REFLEKS_GEMINI_API_KEY"

	// Conventional, explicit filename for release assets. Keep in sync with build/windows/installer/project.nsi
	// Result example: "refleks-0.3.0-windows-amd64-installer.exe"
	WindowsInstallerNameFmt = "refleks-%s-windows-amd64-installer.exe"

	// Cache file names
	BenchmarksCacheFileName = "benchmarks.json"
	SettingsFileName        = "settings.json"
)

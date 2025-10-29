package constants

// Centralized constants for internal services. These are not user-editable and
// should not be persisted to disk. Keep magic strings and URLs here.

const (
	// AppVersion is the human-readable semantic version of the application.
	// Bump this on every release. Follow SemVer: MAJOR.MINOR.PATCH
	AppVersion = "0.3.0"

	// Kovaaks player progress endpoint. Use fmt.Sprintf with benchmarkId and steamId.
	KovaaksPlayerProgressURL = "https://kovaaks.com/webapp-backend/benchmarks/player-progress-rank-benchmark?benchmarkId=%d&steamId=%s"
	// DefaultRecentCap bounds how many recent scenarios we retain in memory when
	// no explicit limit is set in configuration.
	DefaultRecentCap = 500

	// Default UI/analysis values
	DefaultSessionGapMinutes  = 15
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

	// --- Updater/GitHub release info ---
	// GitHub repository owner/name used for update checks and downloads
	GitHubOwner = "ARm8-2"
	GitHubRepo  = "refleks"
	// GitHub API endpoint to retrieve the latest release metadata
	GitHubLatestReleaseAPI = "https://api.github.com/repos/%s/%s/releases/latest"
	// Direct download URL format for release assets
	// Usage: fmt.Sprintf(GitHubDownloadURLFmt, GitHubOwner, GitHubRepo, version, assetName)
	GitHubDownloadURLFmt = "https://github.com/%s/%s/releases/download/%s/%s"

	// Windows asset naming convention, e.g. "refleks-0.3.0.exe"
	// New convention: lowercase, platform + arch + version, URL/FS safe
	// Example produced installer asset: "refleks-windows-amd64-0.3.0.exe"
	WindowsInstallerNameFmt = "refleks-windows-amd64-%s.exe"

	// Updater default timeouts (in seconds)
	// UpdaterHTTPTimeoutSeconds is used for quick API calls (e.g., GitHub latest release). Keep small.
	UpdaterHTTPTimeoutSeconds = 10
	// UpdaterDownloadTimeoutSeconds is used for downloading installer assets. Larger to accommodate slow links.
	UpdaterDownloadTimeoutSeconds = 600
)

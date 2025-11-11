package constants

// Centralized constants for internal services. These are not user-editable and
// should not be persisted to disk. Keep magic strings and URLs here.

const (
	// AppVersion is the human-readable semantic version of the application.
	// Bump this on every release. Follow SemVer: MAJOR.MINOR.PATCH
	AppVersion = "0.5.2"

	// Kovaaks player progress endpoint. Use fmt.Sprintf with benchmarkId and steamId.
	KovaaksPlayerProgressURL = "https://kovaaks.com/webapp-backend/benchmarks/player-progress-rank-benchmark?benchmarkId=%d&steamId=%s"
	// DefaultRecentCap bounds how many recent scenarios we retain in memory when
	// no explicit limit is set in configuration.
	DefaultRecentCap = 500

	// Default UI/analysis values
	DefaultSessionGapMinutes  = 15
	DefaultTheme              = "dark"
	DefaultMouseBufferMinutes = 2
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

	// Conventional, explicit filename for release assets. Keep in sync with build/windows/installer/project.nsi
	// Result example: "refleks-0.3.0-windows-amd64-installer.exe"
	WindowsInstallerNameFmt = "refleks-%s-windows-amd64-installer.exe"

	// Updater default timeouts (in seconds)
	// UpdaterHTTPTimeoutSeconds is used for quick API calls (e.g., GitHub latest release). Keep small.
	UpdaterHTTPTimeoutSeconds = 10
	// UpdaterDownloadTimeoutSeconds is used for downloading installer assets. Larger to accommodate slow links.
	UpdaterDownloadTimeoutSeconds = 600
)

// --- Sensitivity conversion defaults ---
// Default yaw (deg/count) constants for supported game scales. These are used
// by the sensitivity converter to derive cm/360 for linear engines where
// rotation = sensitivity * yaw * counts.
const (
	// Counter‑Strike (CS:GO / CS2) default m_yaw
	YawDegPerCountCSGO = 0.022
)

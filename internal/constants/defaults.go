package constants

const (
	// DefaultRecentCap bounds how many recent scenarios we retain in memory when
	// no explicit limit is set in configuration.
	DefaultRecentCap = 500

	// Default UI/analysis values
	DefaultSessionGapMinutes  = 20
	DefaultTheme              = "dark"
	DefaultFont               = "montserrat"
	DefaultMouseBufferMinutes = 2
	DefaultMaxExistingOnStart = 1000

	// Watcher defaults
	DefaultPollIntervalSeconds = 5

	// Mouse tracking defaults
	DefaultMouseSampleHz = 125

	// Kovaak's process and Steam App information
	KovaaksProcessName = "FPSAimTrainer.exe"
	KovaaksSteamAppID  = 824270

	// Updater default timeouts (in seconds)
	// UpdaterHTTPTimeoutSeconds is used for quick API calls (e.g., GitHub latest release). Keep small.
	UpdaterHTTPTimeoutSeconds = 10
	// UpdaterDownloadTimeoutSeconds is used for downloading installer assets. Larger to accommodate slow links.
	UpdaterDownloadTimeoutSeconds = 600

	// --- Sensitivity conversion defaults ---
	// Default yaw (deg/count) constants for supported game scales. These are used
	// by the sensitivity converter to derive cm/360 for linear engines where
	// rotation = sensitivity * yaw * counts.

	// Counter‑Strike (CS:GO / CS2) default m_yaw
	YawDegPerCountCSGO = 0.022
)

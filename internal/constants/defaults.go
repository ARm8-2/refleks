package constants

const (
	// Default UI/analysis values
	DefaultSessionGapMinutes  = 20
	DefaultTheme              = "dark"
	DefaultFont               = "montserrat"
	DefaultMouseBufferMinutes = 2
	DefaultRecentRunsDays     = 90
	DefaultRecentRunsMinCount = 1500

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
	// RunsSyncHTTPTimeoutSeconds is used for uploading .refleks files to the cloud API.
	RunsSyncHTTPTimeoutSeconds = 20

	// --- Sensitivity conversion defaults ---
	// Default yaw (deg/count) constants for supported game scales. These are used
	// by the sensitivity converter to derive cm/360 for linear engines where
	// rotation = sensitivity * yaw * counts.

	// Source-family yaw (0.022 deg/count) shared by Counter-Strike, CSGO,
	// Apex Legends, Quake/Source, and Quake Champions.
	YawDegPerCountSource = 0.022

	// Yaw shared by Overwatch, Call of Duty, and Destiny 2 (0.0066 deg/count).
	YawDegPerCountOverwatch = 0.0066

	// Valorant yaw (0.06996 deg/count), per Kovaak's FovSensConfig.json.
	YawDegPerCountValorant = 0.06996
)

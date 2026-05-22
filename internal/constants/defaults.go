package constants

import "math"

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

	// Source family yaw (0.022 deg/count) shared by Counter-Strike, CSGO,
	// Apex Legends, Quake/Source, and Quake Champions.
	YawDegPerCountSource = 0.022

	// Overwatch family yaw (0.0066 deg/count) shared by Overwatch, Call of
	// Duty, and Destiny 2.
	YawDegPerCountOverwatch = 0.0066

	// Single-game scales (one constant per Kovaak's Sens Scale entry).
	YawDegPerCountValorant        = 0.06996
	YawDegPerCountHalo            = 0.022222
	YawDegPerCountFortnite        = 0.005555
	YawDegPerCountDiabotical      = 1.0 / 60.0
	YawDegPerCountRust            = 0.1125
	YawDegPerCountUE4             = 0.07
	YawDegPerCountHuntShowdown    = 0.0429718162181364
	YawDegPerCountGundamEvolution = 0.0003888500001
	YawDegPerCountTheFinals       = 0.001
	YawDegPerCountRoblox          = 1.01061008
	YawDegPerCountRobloxArsenal   = 0.375
	YawDegPerCountMarvelRivals    = 0.0175
	YawDegPerCountDeadlock        = 0.044
	YawDegPerCountFragpunk        = 0.05555
	YawDegPerCountStrinova        = 0.01388194363
	YawDegPerCountDeltaForce      = 0.03
	YawDegPerCountBatallion       = 0.017501

	// Shared by Rainbow 6: Siege and Reflex Arena.
	YawDegPerCountSiege = 0.018 / math.Pi
)

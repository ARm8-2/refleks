package constants

import "math"

const (
	LanguageEnglish           = "en"
	LanguageSimplifiedChinese = "zh-CN"

	// Default UI/analysis values
	DefaultSessionGapMinutes  = 20
	DefaultTheme              = "dark"
	DefaultFont               = "montserrat"
	DefaultMouseBufferMinutes = 5
	DefaultRecentRunsDays     = 180
	DefaultRecentRunsMinCount = 2500

	// Watcher defaults
	DefaultPollIntervalSeconds = 5

	// Mouse tracking defaults
	DefaultMouseSampleHz = 125

	// Performances file retry: when fsnotify detects the stats CSV before the
	// matching performances file has been flushed to disk, briefly retry instead
	// of silently omitting the performance data from the run record.
	PerformancesFileRetryIntervalMs = 10
	PerformancesFileMaxRetries      = 30

	// Screen capture defaults and UI-supported limits.
	DefaultScreenCaptureFPS        = 30
	MinScreenCaptureFPS            = 5
	MaxScreenCaptureFPS            = 60
	DefaultScreenCaptureResolution = "720"

	// Screen capture rolling-segment buffer. Recording is split into short,
	// independently-finalized segments (like OBS's replay buffer / GeForce
	// Experience Instant Replay) instead of one continuous session-long file.
	// This bounds disk/memory usage to a small rolling window regardless of
	// how long a play session runs, and lets replays be cut within seconds of
	// a run finishing instead of only after the game process exits.
	// Five-second segments bound the delay before a finished run becomes
	// available, while keeping at most five seconds of safe keyframe lead-in in
	// a stream-copied replay.
	ScreenCaptureSegmentSeconds = 5
	// ScreenCaptureReplayTailSeconds preserves the final visual feedback after
	// a scenario reports its end without affecting the stored run statistics.
	ScreenCaptureReplayTailSeconds    = 2
	ScreenCaptureSegmentRetention     = 5 * 60 // seconds; segments older than this are pruned
	ScreenCaptureTrimPollInterval     = 1      // seconds between readiness checks while waiting on a segment to close
	ScreenCaptureTrimMaxWaitSeconds   = 45     // give up waiting on a run's segment after this long
	ScreenCaptureFinalizeGraceSeconds = 30     // retain stopped segments for late final stats events
	ScreenCaptureShutdownWaitSeconds  = 30     // allow active trims to publish before app exit

	// ScreenCaptureKeyframeIntervalSeconds controls how often a keyframe is
	// forced in the encoded stream. This is intentionally much shorter than
	// ScreenCaptureSegmentSeconds: segment cuts only need to land on *a*
	// keyframe, but trimming a run's replay out of the buffer relies on
	// stream-copying a replay from a segment boundary, so frequent keyframes
	// keep browser seek decode work small and make every segment independently
	// decodable.
	ScreenCaptureKeyframeIntervalSeconds = 1

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

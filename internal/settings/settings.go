package settings

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// DefaultKovaaksInstallDir returns an OS-appropriate default Kovaak's install directory.
func DefaultKovaaksInstallDir() string {
	if env := strings.TrimSpace(GetEnv(constants.EnvKovaaksInstallDirVar)); env != "" {
		return NormalizeKovaaksInstallDir(env)
	}
	if runtime.GOOS == "windows" {
		return constants.DefaultWindowsKovaaksInstallDir
	}
	return ""
}

// NormalizeKovaaksInstallDir trims, normalizes separators, and cleans the install path.
func NormalizeKovaaksInstallDir(p string) string {
	p = strings.TrimSpace(ExpandPathPlaceholders(p))
	if p == "" {
		return ""
	}
	return filepath.Clean(p)
}

// ResolveKovaaksStatsDir derives the stats directory from the configured install directory.
func ResolveKovaaksStatsDir(installDir string) string {
	installDir = NormalizeKovaaksInstallDir(installDir)
	if installDir == "" {
		return ""
	}
	return filepath.Join(installDir, constants.KovaaksDataDirName, constants.KovaaksStatsDirName)
}

// Default returns sane default settings for a fresh install.
func Default() models.Settings {
	return models.Settings{
		SteamInstallDir:         constants.DefaultWindowsSteamInstallDir,
		KovaaksInstallDir:       DefaultKovaaksInstallDir(),
		SessionGapMinutes:       constants.DefaultSessionGapMinutes,
		RecentRunsDays:          constants.DefaultRecentRunsDays,
		RecentRunsMinCount:      constants.DefaultRecentRunsMinCount,
		Theme:                   constants.DefaultTheme,
		Font:                    constants.DefaultFont,
		Scale:                   constants.DefaultScale,
		MouseTrackingEnabled:    true,
		MouseBufferMinutes:      constants.DefaultMouseBufferMinutes,
		ScreenCaptureEnabled:    false,
		ScreenCaptureFPS:        constants.DefaultScreenCaptureFPS,
		ScreenCaptureResolution: constants.DefaultScreenCaptureResolution,
		ReplayCleanupEnabled:    true,
		ReplayRetentionDays:     constants.DefaultReplayRetentionDays,
		ReplayStorageLimitGB:    constants.DefaultReplayStorageLimitGB,
		AutostartEnabled:        false,
		AnonymousEnabled:        false,
		RunSyncEnabled:          true,
		LastSeenVersion:         "",
	}
}

// Sanitize applies defaults to zero/empty fields and returns the updated copy.
func Sanitize(s models.Settings) models.Settings {
	if strings.TrimSpace(s.SteamInstallDir) == "" {
		s.SteamInstallDir = constants.DefaultWindowsSteamInstallDir
	}
	s.KovaaksInstallDir = NormalizeKovaaksInstallDir(s.KovaaksInstallDir)
	if s.KovaaksInstallDir == "" {
		s.KovaaksInstallDir = DefaultKovaaksInstallDir()
	}
	if s.SessionGapMinutes <= 0 {
		s.SessionGapMinutes = constants.DefaultSessionGapMinutes
	}
	if s.RecentRunsDays <= 0 {
		s.RecentRunsDays = constants.DefaultRecentRunsDays
	}
	if s.RecentRunsMinCount <= 0 {
		s.RecentRunsMinCount = constants.DefaultRecentRunsMinCount
	}
	if strings.TrimSpace(s.Theme) == "" {
		s.Theme = constants.DefaultTheme
	}
	if strings.TrimSpace(s.Font) == "" {
		s.Font = constants.DefaultFont
	}
	s.Scale = sanitizeScale(s.Scale)
	if s.MouseBufferMinutes <= 0 {
		s.MouseBufferMinutes = constants.DefaultMouseBufferMinutes
	}
	s.ScreenCaptureFPS = sanitizeScreenCaptureFPS(s.ScreenCaptureFPS)
	s.ScreenCaptureResolution = sanitizeScreenCaptureResolution(s.ScreenCaptureResolution)
	if s.ReplayRetentionDays < 0 {
		s.ReplayRetentionDays = 0
	}
	if s.ReplayStorageLimitGB < 0 {
		s.ReplayStorageLimitGB = 0
	}

	if s.ScenarioNotes == nil {
		s.ScenarioNotes = make(map[string]models.ScenarioNote)
	}
	if s.SessionNotes == nil {
		s.SessionNotes = make(map[string]models.SessionNote)
	}
	return s
}

func sanitizeScale(scale string) string {
	for _, valid := range constants.ValidScales {
		if scale == valid {
			return scale
		}
	}
	return constants.DefaultScale
}

func sanitizeScreenCaptureFPS(fps int) int {
	if fps < constants.MinScreenCaptureFPS || fps > constants.MaxScreenCaptureFPS {
		return constants.DefaultScreenCaptureFPS
	}
	return fps
}

func sanitizeScreenCaptureResolution(resolution string) string {
	resolution = strings.ToLower(strings.TrimSpace(resolution))
	switch resolution {
	case "native", "1080", "900", "720":
		return resolution
	default:
		return constants.DefaultScreenCaptureResolution
	}
}

// GetConfigDir returns the application config directory under the user's home dir: $HOME/.refleks
// It does not ensure the directory exists.
func GetConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, constants.ConfigDirName), nil
}

// EnsureConfigDir returns the application config directory, creating it if necessary.
func EnsureConfigDir() (string, error) {
	base, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", err
	}
	return base, nil
}

// ExpandPathPlaceholders normalizes a path string for the current OS. No placeholders are supported.
func ExpandPathPlaceholders(p string) string {
	if p == "" {
		return p
	}
	// Convert any forward slashes to OS-native separators
	return filepath.FromSlash(p)
}

// Path returns the settings file path under the user home config directory ($HOME/.refleks).
func Path() (string, error) {
	base, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "settings.json"), nil
}

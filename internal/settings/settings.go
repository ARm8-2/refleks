package settings

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// DefaultStatsDir returns an OS-appropriate default Kovaak's stats directory.
func DefaultStatsDir() string {
	// Allow an environment override in all environments
	if env := GetEnv(constants.EnvStatsDirVar); strings.TrimSpace(env) != "" {
		return ExpandPathPlaceholders(strings.TrimSpace(env))
	}
	if runtime.GOOS == "windows" {
		return constants.DefaultWindowsKovaaksStatsDir
	}
	// No fallback for non-Windows; leave empty so user/env must configure
	return ""
}

// Default returns sane default settings for a fresh install.
func Default() models.Settings {
	return models.Settings{
		SteamInstallDir:      constants.DefaultWindowsSteamInstallDir,
		StatsDir:             DefaultStatsDir(),
		SessionGapMinutes:    constants.DefaultSessionGapMinutes,
		RecentRunsDays:       constants.DefaultRecentRunsDays,
		RecentRunsMinCount:   constants.DefaultRecentRunsMinCount,
		Theme:                constants.DefaultTheme,
		Font:                 constants.DefaultFont,
		MouseTrackingEnabled: false,
		MouseBufferMinutes:   constants.DefaultMouseBufferMinutes,
		AutostartEnabled:     false,
		AnonymousEnabled:     false,
		RunSyncEnabled:       true,
	}
}

// Sanitize applies defaults to zero/empty fields and returns the updated copy.
func Sanitize(s models.Settings) models.Settings {
	if strings.TrimSpace(s.SteamInstallDir) == "" {
		s.SteamInstallDir = constants.DefaultWindowsSteamInstallDir
	}
	if s.StatsDir == "" {
		s.StatsDir = DefaultStatsDir()
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
	if s.MouseBufferMinutes <= 0 {
		s.MouseBufferMinutes = constants.DefaultMouseBufferMinutes
	}
	if s.ScenarioNotes == nil {
		s.ScenarioNotes = make(map[string]models.ScenarioNote)
	}
	if s.SessionNotes == nil {
		s.SessionNotes = make(map[string]models.SessionNote)
	}
	return s
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

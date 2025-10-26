package settings

import (
	"encoding/json"
	"errors"
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
		TracesDir:            DefaultTracesDirString(),
		SessionGapMinutes:    constants.DefaultSessionGapMinutes,
		Theme:                constants.DefaultTheme,
		MouseTrackingEnabled: false,
		MouseBufferMinutes:   constants.DefaultMouseBufferMinutes,
		MaxExistingOnStart:   constants.DefaultMaxExistingOnStart,
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
	if strings.TrimSpace(s.TracesDir) == "" {
		s.TracesDir = DefaultTracesDirString()
	}
	if s.SessionGapMinutes <= 0 {
		s.SessionGapMinutes = constants.DefaultSessionGapMinutes
	}
	if s.MouseBufferMinutes <= 0 {
		s.MouseBufferMinutes = constants.DefaultMouseBufferMinutes
	}
	if s.MaxExistingOnStart <= 0 {
		s.MaxExistingOnStart = constants.DefaultMaxExistingOnStart
	}
	return s
}

// ConfigBaseDir returns the application config directory under the user's home dir: $HOME/.refleks
func ConfigBaseDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	base := filepath.Join(home, constants.ConfigDirName)
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", err
	}
	return base, nil
}

// DefaultTracesDirString returns the default traces directory as a concrete path string.
func DefaultTracesDirString() string {
	base, err := ConfigBaseDir()
	if err != nil {
		// Fallback to relative subdir if home/config cannot be determined
		return filepath.ToSlash(constants.TracesSubdirName)
	}
	return filepath.ToSlash(filepath.Join(base, constants.TracesSubdirName))
}

// DefaultTracesDir returns the resolved default traces directory ($HOME/.refleks/traces).
func DefaultTracesDir() (string, error) {
	base, err := ConfigBaseDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, constants.TracesSubdirName), nil
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
	base, err := ConfigBaseDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "settings.json"), nil
}

// Load reads settings from disk.
func Load() (models.Settings, error) {
	path, err := Path()
	if err != nil {
		return models.Settings{}, err
	}
	b, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return models.Settings{}, errors.New("no settings yet")
		}
		return models.Settings{}, err
	}
	var s models.Settings
	if err := json.Unmarshal(b, &s); err != nil {
		return models.Settings{}, err
	}
	return s, nil
}

// Save writes settings to disk.
func Save(s models.Settings) error {
	path, err := Path()
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}

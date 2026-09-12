package settings

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"refleks/internal/constants"
	"refleks/internal/detect"
	"refleks/internal/models"
)

// DefaultSteamInstallDir returns an OS-appropriate default Steam install
// directory. Priority order: environment override, auto-detection, platform
// fallback.
func DefaultSteamInstallDir() string {
	if env := strings.TrimSpace(GetEnv(constants.EnvSteamInstallDirVar)); env != "" {
		return NormalizeInstallDir(env)
	}
	if dir := detect.SteamInstallDir(); dir != "" {
		return NormalizeInstallDir(dir)
	}
	if runtime.GOOS == "windows" {
		return constants.DefaultWindowsSteamInstallDir
	}
	return ""
}

// DefaultKovaaksInstallDir returns an OS-appropriate default Kovaak's install
// directory. Priority order: environment override, auto-detection, platform
// fallback.
func DefaultKovaaksInstallDir() string {
	if env := strings.TrimSpace(GetEnv(constants.EnvKovaaksInstallDirVar)); env != "" {
		return NormalizeInstallDir(env)
	}
	if dir := detect.KovaaksInstallDir(); dir != "" {
		return NormalizeInstallDir(dir)
	}
	if runtime.GOOS == "windows" {
		return constants.DefaultWindowsKovaaksInstallDir
	}
	return ""
}

// NormalizeInstallDir trims, expands placeholders, and cleans an install path
// so callers can rely on a canonical form regardless of how the user typed it.
func NormalizeInstallDir(p string) string {
	p = strings.TrimSpace(ExpandPathPlaceholders(p))
	if p == "" {
		return ""
	}
	return filepath.Clean(p)
}

// ResolveKovaaksStatsDir derives the stats directory from the configured install directory.
func ResolveKovaaksStatsDir(installDir string) string {
	installDir = NormalizeInstallDir(installDir)
	if installDir == "" {
		return ""
	}
	return filepath.Join(installDir, constants.KovaaksDataDirName, constants.KovaaksStatsDirName)
}

// DefaultSteamID returns a default Steam ID for a fresh install: the
// REFLEKS_STEAM_ID environment override when set, otherwise the MostRecent
// user in the default Steam installation's loginusers.vdf.
func DefaultSteamID() string {
	return steamIDDefault(DefaultSteamInstallDir())
}

// DefaultPersonaName returns a default persona name for a fresh install: the
// REFLEKS_PERSONA_NAME environment override when set, otherwise the MostRecent
// user in the default Steam installation's loginusers.vdf.
func DefaultPersonaName() string {
	return personaNameDefault(DefaultSteamInstallDir())
}

// steamIDDefault resolves a default Steam ID for the given Steam directory.
func steamIDDefault(steamDir string) string {
	if env := strings.TrimSpace(GetEnv(constants.EnvSteamIDVar)); env != "" {
		return env
	}
	id, _ := detect.SteamAccount(steamDir)
	return id
}

// personaNameDefault resolves a default persona name for the given Steam
// directory.
func personaNameDefault(steamDir string) string {
	if env := strings.TrimSpace(GetEnv(constants.EnvPersonaNameVar)); env != "" {
		return env
	}
	_, name := detect.SteamAccount(steamDir)
	return name
}

// Default returns sane default settings for a fresh install.
func Default() models.Settings {
	return models.Settings{
		SteamInstallDir:         DefaultSteamInstallDir(),
		KovaaksInstallDir:       DefaultKovaaksInstallDir(),
		SteamIDOverride:         DefaultSteamID(),
		PersonaNameOverride:     DefaultPersonaName(),
		SessionGapMinutes:       constants.DefaultSessionGapMinutes,
		RecentRunsDays:          constants.DefaultRecentRunsDays,
		RecentRunsMinCount:      constants.DefaultRecentRunsMinCount,
		Theme:                   constants.DefaultTheme,
		Font:                    constants.DefaultFont,
		Scale:                   constants.DefaultScale,
		Language:                constants.DefaultLanguage,
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
	s.SteamInstallDir = NormalizeInstallDir(s.SteamInstallDir)
	if s.SteamInstallDir == "" {
		s.SteamInstallDir = DefaultSteamInstallDir()
	}
	s.KovaaksInstallDir = NormalizeInstallDir(s.KovaaksInstallDir)
	if s.KovaaksInstallDir == "" {
		s.KovaaksInstallDir = DefaultKovaaksInstallDir()
	}
	// Auto-detect the Steam account when nothing is configured yet, mirroring
	// how the install directories are filled in. An empty value resolves
	// against the configured Steam install directory, so a manually cleared
	// field re-detects instead of staying stale.
	s.SteamIDOverride = strings.TrimSpace(s.SteamIDOverride)
	if s.SteamIDOverride == "" {
		s.SteamIDOverride = steamIDDefault(s.SteamInstallDir)
	}
	s.PersonaNameOverride = strings.TrimSpace(s.PersonaNameOverride)
	if s.PersonaNameOverride == "" {
		s.PersonaNameOverride = personaNameDefault(s.SteamInstallDir)
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
	s.Theme = sanitizeTheme(s.Theme)
	if strings.TrimSpace(s.Font) == "" {
		s.Font = constants.DefaultFont
	}
	s.Scale = sanitizeScale(s.Scale)
	s.Language = sanitizeLanguage(s.Language)
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

func sanitizeTheme(theme string) string {
	theme = strings.ToLower(strings.TrimSpace(theme))
	for _, valid := range constants.ValidThemes {
		if theme == valid {
			return theme
		}
	}
	return constants.DefaultTheme
}

func sanitizeScale(scale string) string {
	for _, valid := range constants.ValidScales {
		if scale == valid {
			return scale
		}
	}
	return constants.DefaultScale
}

// sanitizeLanguage validates the language code against the supported set,
// falling back to the default when unknown or empty.
func sanitizeLanguage(language string) string {
	for _, valid := range constants.ValidLanguages {
		if language == valid {
			return language
		}
	}
	return constants.DefaultLanguage
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
	return ConfigFilePath(constants.SettingsFileName)
}

// ConfigFilePath returns the path to a named file inside the app config
// directory ($HOME/.refleks/<name>). It does not ensure the directory exists.
func ConfigFilePath(fileName string) (string, error) {
	base, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, fileName), nil
}

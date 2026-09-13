package settings

import (
	"path/filepath"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func TestNormalizeInstallDir(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"   ", ""},
		{" /a/b/../c ", filepath.Clean("/a/b/../c")},
		{"/a/b/", filepath.Clean("/a/b/")},
		{"/already/clean", "/already/clean"},
	}
	for _, tt := range tests {
		if got := NormalizeInstallDir(tt.in); got != tt.want {
			t.Errorf("NormalizeInstallDir(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestResolveKovaaksStatsDir(t *testing.T) {
	want := filepath.Join("/games", constants.KovaaksDataDirName, constants.KovaaksStatsDirName)
	if got := ResolveKovaaksStatsDir("/games"); got != want {
		t.Errorf("ResolveKovaaksStatsDir(/games) = %q, want %q", got, want)
	}
	if got := ResolveKovaaksStatsDir("  "); got != "" {
		t.Errorf("ResolveKovaaksStatsDir(blank) = %q, want empty", got)
	}
}

func TestSanitizeEnums(t *testing.T) {
	themeTests := map[string]string{"": "dark", "DARK": "dark", " light ": "light", "custom": "custom", "neon": "dark"}
	for in, want := range themeTests {
		if got := sanitizeTheme(in); got != want {
			t.Errorf("sanitizeTheme(%q) = %q, want %q", in, got, want)
		}
	}

	scaleTests := map[string]string{"100": "100", "125": "125", "999": "100", "": "100"}
	for in, want := range scaleTests {
		if got := sanitizeScale(in); got != want {
			t.Errorf("sanitizeScale(%q) = %q, want %q", in, got, want)
		}
	}

	languageTests := map[string]string{"en": "en", "zh-CN": "zh-CN", " zz ": "en", "zz": "en", "": "en"}
	for in, want := range languageTests {
		if got := sanitizeLanguage(in); got != want {
			t.Errorf("sanitizeLanguage(%q) = %q, want %q", in, got, want)
		}
	}

	fpsTests := map[int]int{5: 5, 30: 30, 60: 60, 4: 30, 61: 30, 0: 30}
	for in, want := range fpsTests {
		if got := sanitizeScreenCaptureFPS(in); got != want {
			t.Errorf("sanitizeScreenCaptureFPS(%d) = %d, want %d", in, got, want)
		}
	}

	resolutionTests := map[string]string{
		"native": "native", "1080": "1080", "900": "900", "720": "720",
		" NATIVE ": "native", "1440": "720", "": "720",
	}
	for in, want := range resolutionTests {
		if got := sanitizeScreenCaptureResolution(in); got != want {
			t.Errorf("sanitizeScreenCaptureResolution(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSanitizeFillsDefaultsAndClamps(t *testing.T) {
	t.Setenv(constants.EnvSteamInstallDirVar, " /steam ")
	t.Setenv(constants.EnvKovaaksInstallDirVar, "/kovaaks")
	t.Setenv(constants.EnvSteamIDVar, "76561198000000000")
	t.Setenv(constants.EnvPersonaNameVar, "player")

	s := Sanitize(models.Settings{
		SessionGapMinutes:       0,
		RecentRunsDays:          -1,
		RecentRunsMinCount:      0,
		Theme:                   "BOGUS",
		Font:                    "  ",
		Scale:                   "999",
		Language:                "zz",
		MouseBufferMinutes:      0,
		ScreenCaptureFPS:        999,
		ScreenCaptureResolution: "1440",
		ReplayRetentionDays:     -5,
		ReplayStorageLimitGB:    -1,
		MouseTrackingEnabled:    true,
	})

	if s.SteamInstallDir != "/steam" {
		t.Errorf("SteamInstallDir = %q, want /steam", s.SteamInstallDir)
	}
	if s.KovaaksInstallDir != "/kovaaks" {
		t.Errorf("KovaaksInstallDir = %q, want /kovaaks", s.KovaaksInstallDir)
	}
	if s.SteamIDOverride != "76561198000000000" {
		t.Errorf("SteamIDOverride = %q", s.SteamIDOverride)
	}
	if s.PersonaNameOverride != "player" {
		t.Errorf("PersonaNameOverride = %q", s.PersonaNameOverride)
	}
	if s.SessionGapMinutes != constants.DefaultSessionGapMinutes {
		t.Errorf("SessionGapMinutes = %d", s.SessionGapMinutes)
	}
	if s.RecentRunsDays != constants.DefaultRecentRunsDays {
		t.Errorf("RecentRunsDays = %d", s.RecentRunsDays)
	}
	if s.RecentRunsMinCount != constants.DefaultRecentRunsMinCount {
		t.Errorf("RecentRunsMinCount = %d", s.RecentRunsMinCount)
	}
	if s.Theme != constants.DefaultTheme {
		t.Errorf("Theme = %q", s.Theme)
	}
	if s.Font != constants.DefaultFont {
		t.Errorf("Font = %q", s.Font)
	}
	if s.Scale != constants.DefaultScale {
		t.Errorf("Scale = %q", s.Scale)
	}
	if s.Language != constants.DefaultLanguage {
		t.Errorf("Language = %q", s.Language)
	}
	if s.MouseBufferMinutes != constants.DefaultMouseBufferMinutes {
		t.Errorf("MouseBufferMinutes = %d", s.MouseBufferMinutes)
	}
	if s.ScreenCaptureFPS != constants.DefaultScreenCaptureFPS {
		t.Errorf("ScreenCaptureFPS = %d", s.ScreenCaptureFPS)
	}
	if s.ScreenCaptureResolution != constants.DefaultScreenCaptureResolution {
		t.Errorf("ScreenCaptureResolution = %q", s.ScreenCaptureResolution)
	}
	if s.ReplayRetentionDays != 0 {
		t.Errorf("ReplayRetentionDays = %d, want 0", s.ReplayRetentionDays)
	}
	if s.ReplayStorageLimitGB != 0 {
		t.Errorf("ReplayStorageLimitGB = %d, want 0", s.ReplayStorageLimitGB)
	}
	if s.ScenarioNotes == nil || s.SessionNotes == nil {
		t.Error("note maps should be initialized")
	}
	if !s.MouseTrackingEnabled {
		t.Error("MouseTrackingEnabled should be preserved")
	}
}

func TestSanitizePreservesValidValues(t *testing.T) {
	t.Setenv(constants.EnvSteamInstallDirVar, "/steam")

	s := Sanitize(models.Settings{
		SteamInstallDir:         "/custom/steam",
		KovaaksInstallDir:       "/custom/kovaaks",
		SteamIDOverride:         "123",
		PersonaNameOverride:     "me",
		SessionGapMinutes:       45,
		RecentRunsDays:          30,
		RecentRunsMinCount:      10,
		Theme:                   "light",
		Font:                    "inter",
		Scale:                   "125",
		Language:                "ja",
		MouseTrackingEnabled:    false,
		MouseBufferMinutes:      10,
		ScreenCaptureEnabled:    true,
		ScreenCaptureFPS:        60,
		ScreenCaptureResolution: "native",
		ReplayCleanupEnabled:    true,
		ReplayRetentionDays:     7,
		ReplayStorageLimitGB:    3,
		AutostartEnabled:        true,
		RunSyncEnabled:          true,
	})

	if s.SteamInstallDir != "/custom/steam" || s.KovaaksInstallDir != "/custom/kovaaks" {
		t.Errorf("install dirs changed: %q / %q", s.SteamInstallDir, s.KovaaksInstallDir)
	}
	if s.SteamIDOverride != "123" || s.PersonaNameOverride != "me" {
		t.Errorf("account overrides changed: %q / %q", s.SteamIDOverride, s.PersonaNameOverride)
	}
	if s.SessionGapMinutes != 45 || s.RecentRunsDays != 30 || s.RecentRunsMinCount != 10 {
		t.Errorf("numeric settings changed: %+v", s)
	}
	if s.Theme != "light" || s.Font != "inter" || s.Scale != "125" || s.Language != "ja" {
		t.Errorf("appearance settings changed: %+v", s)
	}
	if s.ScreenCaptureFPS != 60 || s.ScreenCaptureResolution != "native" {
		t.Errorf("capture settings changed: %+v", s)
	}
	if s.MouseTrackingEnabled || !s.ScreenCaptureEnabled || !s.AutostartEnabled {
		t.Errorf("boolean settings changed: %+v", s)
	}
}

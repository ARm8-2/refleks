package settings

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

type serviceTestEnvironment struct {
	home       string
	steamDir   string
	kovaaksDir string
}

func newServiceTestEnvironment(t *testing.T) serviceTestEnvironment {
	t.Helper()
	env := serviceTestEnvironment{home: t.TempDir()}
	env.steamDir = filepath.Join(env.home, "steam")
	env.kovaaksDir = filepath.Join(env.home, "kovaaks")
	for _, dir := range []string{env.steamDir, env.kovaaksDir} {
		if err := os.Mkdir(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("HOME", env.home)
	t.Setenv("USERPROFILE", env.home)
	// Nonempty overrides bypass both dotenv loading and machine/account detection.
	t.Setenv(constants.EnvSteamInstallDirVar, env.steamDir)
	t.Setenv(constants.EnvKovaaksInstallDirVar, env.kovaaksDir)
	t.Setenv(constants.EnvSteamIDVar, "76561198000000000")
	t.Setenv(constants.EnvPersonaNameVar, "test-player")
	return env
}

func (env serviceTestEnvironment) configDir() string {
	return filepath.Join(env.home, constants.ConfigDirName)
}

func (env serviceTestEnvironment) settingsPath() string {
	return filepath.Join(env.configDir(), constants.SettingsFileName)
}

func (env serviceTestEnvironment) defaults() models.Settings {
	return models.Settings{
		SteamInstallDir:         env.steamDir,
		KovaaksInstallDir:       env.kovaaksDir,
		SteamIDOverride:         "76561198000000000",
		PersonaNameOverride:     "test-player",
		SessionGapMinutes:       constants.DefaultSessionGapMinutes,
		RecentRunsDays:          constants.DefaultRecentRunsDays,
		RecentRunsMinCount:      constants.DefaultRecentRunsMinCount,
		Theme:                   constants.DefaultTheme,
		Font:                    constants.DefaultFont,
		Scale:                   constants.DefaultScale,
		Language:                constants.DefaultLanguage,
		MouseTrackingEnabled:    true,
		MouseBufferMinutes:      constants.DefaultMouseBufferMinutes,
		ScreenCaptureFPS:        constants.DefaultScreenCaptureFPS,
		ScreenCaptureResolution: constants.DefaultScreenCaptureResolution,
		ReplayCleanupEnabled:    true,
		ReplayRetentionDays:     constants.DefaultReplayRetentionDays,
		ReplayStorageLimitGB:    constants.DefaultReplayStorageLimitGB,
		RunSyncEnabled:          true,
	}
}

func assertServiceSettings(t *testing.T, got, want models.Settings) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("settings mismatch:\n got: %#v\nwant: %#v", got, want)
	}
}

func readServiceSettings(t *testing.T, path string) models.Settings {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read settings: %v", err)
	}
	var got models.Settings
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("decode persisted settings: %v", err)
	}
	return got
}

func TestServiceLoadFirstRunPersistsDefaults(t *testing.T) {
	env := newServiceTestEnvironment(t)
	service := NewService()
	want := env.defaults()
	assertServiceSettings(t, service.Get(), want)
	if _, err := os.Stat(env.configDir()); !os.IsNotExist(err) {
		t.Fatalf("config directory before Load: got %v, want not-exist error", err)
	}

	if err := service.Load(); err != nil {
		t.Fatalf("first-run Load: %v", err)
	}
	assertServiceSettings(t, service.Get(), want)
	assertServiceSettings(t, readServiceSettings(t, env.settingsPath()), want)

	// Loading an existing file also initializes the note maps via Sanitize.
	want.ScenarioNotes = map[string]models.ScenarioNote{}
	want.SessionNotes = map[string]models.SessionNote{}
	reloaded := NewService()
	if err := reloaded.Load(); err != nil {
		t.Fatalf("reload first-run settings: %v", err)
	}
	assertServiceSettings(t, reloaded.Get(), want)
}

func TestServiceLoadPartialAndLegacySettings(t *testing.T) {
	tests := []struct {
		name string
		json string
		want func(*models.Settings)
	}{
		{
			name: "empty object keeps all defaults",
			json: `{}`,
			want: func(*models.Settings) {},
		},
		{
			name: "legacy fields and unknown field",
			json: `{"theme":"light","sessionGapMinutes":45,"favoriteBenchmarks":["legacy"],"obsoleteOption":"ignored"}`,
			want: func(s *models.Settings) {
				s.Theme = "light"
				s.SessionGapMinutes = 45
				s.FavoriteBenchmarks = []string{"legacy"}
			},
		},
		{
			name: "explicit false overrides default true",
			json: `{"mouseTrackingEnabled":false,"replayCleanupEnabled":false,"runSyncEnabled":false}`,
			want: func(s *models.Settings) {
				s.MouseTrackingEnabled = false
				s.ReplayCleanupEnabled = false
				s.RunSyncEnabled = false
			},
		},
		{
			name: "mixed explicit and absent booleans",
			json: `{"mouseTrackingEnabled":false,"screenCaptureEnabled":true,"autostartEnabled":true,"anonymousEnabled":true}`,
			want: func(s *models.Settings) {
				s.MouseTrackingEnabled = false
				s.ScreenCaptureEnabled = true
				s.AutostartEnabled = true
				s.AnonymousEnabled = true
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := newServiceTestEnvironment(t)
			if err := os.Mkdir(env.configDir(), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(env.settingsPath(), []byte(tt.json), 0o600); err != nil {
				t.Fatal(err)
			}
			service := NewService()
			if err := service.Load(); err != nil {
				t.Fatalf("Load: %v", err)
			}
			want := env.defaults()
			want.ScenarioNotes = map[string]models.ScenarioNote{}
			want.SessionNotes = map[string]models.SessionNote{}
			tt.want(&want)
			assertServiceSettings(t, service.Get(), want)
		})
	}
}

func TestServiceUpdateSanitizesAndReloads(t *testing.T) {
	tests := []struct {
		name     string
		settings func(serviceTestEnvironment) (models.Settings, models.Settings)
	}{
		{
			name: "invalid values and empty overrides",
			settings: func(env serviceTestEnvironment) (models.Settings, models.Settings) {
				input := models.Settings{
					SteamInstallDir:         " \t ",
					KovaaksInstallDir:       " ",
					SteamIDOverride:         " \t ",
					PersonaNameOverride:     " \n ",
					SessionGapMinutes:       -1,
					RecentRunsDays:          -5,
					RecentRunsMinCount:      0,
					Theme:                   "neon",
					Font:                    " \t ",
					Scale:                   "999",
					Language:                "zz",
					MouseBufferMinutes:      -1,
					ScreenCaptureEnabled:    true,
					ScreenCaptureFPS:        999,
					ScreenCaptureResolution: "1440",
					ReplayRetentionDays:     -7,
					ReplayStorageLimitGB:    -3,
					AnonymousEnabled:        true,
				}
				want := env.defaults()
				want.MouseTrackingEnabled = false
				want.ReplayCleanupEnabled = false
				want.RunSyncEnabled = false
				want.ScreenCaptureEnabled = true
				want.AnonymousEnabled = true
				want.ReplayRetentionDays = 0
				want.ReplayStorageLimitGB = 0
				want.ScenarioNotes = map[string]models.ScenarioNote{}
				want.SessionNotes = map[string]models.SessionNote{}
				return input, want
			},
		},
		{
			name: "normalized values and user metadata",
			settings: func(env serviceTestEnvironment) (models.Settings, models.Settings) {
				want := models.Settings{
					SteamInstallDir:         filepath.Join(env.home, "custom-steam"),
					KovaaksInstallDir:       filepath.Join(env.home, "custom-kovaaks"),
					SteamIDOverride:         "123456789",
					PersonaNameOverride:     "custom-player",
					LastSeenVersion:         "v1.2.3",
					SessionGapMinutes:       45,
					RecentRunsDays:          7,
					RecentRunsMinCount:      10,
					Theme:                   "light",
					Font:                    "inter",
					Scale:                   "125",
					Language:                "ja",
					FavoriteBenchmarks:      []string{"second", "first"},
					MouseTrackingEnabled:    true,
					MouseBufferMinutes:      10,
					ScreenCaptureEnabled:    true,
					ScreenCaptureFPS:        60,
					ScreenCaptureResolution: "native",
					ReplayCleanupEnabled:    true,
					ReplayRetentionDays:     7,
					ReplayStorageLimitGB:    3,
					AutostartEnabled:        true,
					AnonymousEnabled:        true,
					RunSyncEnabled:          true,
					ScenarioNotes: map[string]models.ScenarioNote{
						"scenario": {Notes: "line one\n練習", Sens: "35 cm/360"},
					},
					SessionNotes: map[string]models.SessionNote{
						"session": {Name: "Warmup", Notes: "keep \"quotes\" and whitespace "},
					},
				}
				input := want
				input.SteamInstallDir = " \t" + want.SteamInstallDir + "/cache/../ "
				input.KovaaksInstallDir = " " + want.KovaaksInstallDir + "/cache/../ \n"
				input.SteamIDOverride = " " + want.SteamIDOverride + "\t"
				input.PersonaNameOverride = "\t" + want.PersonaNameOverride + " "
				input.Theme = " LIGHT "
				input.ScreenCaptureResolution = " NATIVE "
				return input, want
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := newServiceTestEnvironment(t)
			input, want := tt.settings(env)
			service := NewService()
			if err := service.Update(input); err != nil {
				t.Fatalf("Update: %v", err)
			}
			assertServiceSettings(t, service.Get(), want)
			// Empty note maps are omitted from JSON, but Load must restore them.
			persistedWant := want
			if len(persistedWant.ScenarioNotes) == 0 {
				persistedWant.ScenarioNotes = nil
			}
			if len(persistedWant.SessionNotes) == 0 {
				persistedWant.SessionNotes = nil
			}
			assertServiceSettings(t, readServiceSettings(t, env.settingsPath()), persistedWant)
			reloaded := NewService()
			if err := reloaded.Load(); err != nil {
				t.Fatalf("Load after Update: %v", err)
			}
			assertServiceSettings(t, reloaded.Get(), want)
		})
	}
}

func TestServiceFavoriteBenchmarksPersist(t *testing.T) {
	env := newServiceTestEnvironment(t)
	service := NewService()
	if got := service.GetFavoriteBenchmarks(); len(got) != 0 {
		t.Fatalf("initial favorites = %v, want none", got)
	}
	base := env.defaults()
	base.Theme = "light"
	base.ScenarioNotes = map[string]models.ScenarioNote{"scenario": {Notes: "preserve me"}}
	base.SessionNotes = map[string]models.SessionNote{"session": {Name: "Warmup"}}
	if err := service.Update(base); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		ids  []string
	}{
		{"set ordered favorites", []string{"benchmark-b", "benchmark-a"}},
		{"replace favorites", []string{"benchmark-c"}},
		{"clear with empty slice", []string{}},
		{"set again", []string{"benchmark-d"}},
		{"clear with nil", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := service.SetFavoriteBenchmarks(tt.ids); err != nil {
				t.Fatalf("SetFavoriteBenchmarks: %v", err)
			}
			if got := service.GetFavoriteBenchmarks(); !reflect.DeepEqual(got, tt.ids) {
				t.Errorf("favorites = %#v, want %#v", got, tt.ids)
			}
			want := base
			want.FavoriteBenchmarks = tt.ids
			assertServiceSettings(t, service.Get(), want)
			if len(tt.ids) == 0 {
				want.FavoriteBenchmarks = nil
			}
			assertServiceSettings(t, readServiceSettings(t, env.settingsPath()), want)
			reloaded := NewService()
			if err := reloaded.Load(); err != nil {
				t.Fatalf("reload favorites: %v", err)
			}
			assertServiceSettings(t, reloaded.Get(), want)
			if got := reloaded.GetFavoriteBenchmarks(); !reflect.DeepEqual(got, want.FavoriteBenchmarks) {
				t.Errorf("reloaded favorites = %#v, want %#v", got, want.FavoriteBenchmarks)
			}
		})
	}
}

func TestServiceLoadMalformedFilePreservesCurrentSettings(t *testing.T) {
	tests := []struct {
		name string
		json string
	}{
		{"invalid syntax", `{"theme":"light","recentRunsDays":nope}`},
		{"truncated object", `{"theme":"light","favoriteBenchmarks":["replacement"],`},
		{"wrong field type", `{"theme":"light","favoriteBenchmarks":["replacement"],"recentRunsDays":"not-an-int"}`},
		{"empty file", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := newServiceTestEnvironment(t)
			service := NewService()
			want := env.defaults()
			want.Theme = "custom"
			want.FavoriteBenchmarks = []string{"keep"}
			want.MouseTrackingEnabled = false
			want.ScenarioNotes = map[string]models.ScenarioNote{"scenario": {Notes: "keep"}}
			want.SessionNotes = map[string]models.SessionNote{"session": {Name: "keep"}}
			if err := service.Update(want); err != nil {
				t.Fatal(err)
			}
			data := []byte(tt.json)
			if err := os.WriteFile(env.settingsPath(), data, 0o600); err != nil {
				t.Fatal(err)
			}
			if err := service.Load(); err == nil {
				t.Fatal("Load malformed settings succeeded, want error")
			}
			assertServiceSettings(t, service.Get(), want)
			got, err := os.ReadFile(env.settingsPath())
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(got, data) {
				t.Errorf("Load rewrote malformed file: got %q, want %q", got, data)
			}
		})
	}
}

func TestServiceFilesystemErrors(t *testing.T) {
	obstacles := []struct {
		name  string
		setup func(*testing.T, serviceTestEnvironment) (errorPath, markerPath string)
	}{
		{
			name: "config directory is a regular file",
			setup: func(t *testing.T, env serviceTestEnvironment) (string, string) {
				t.Helper()
				if err := os.Remove(env.configDir()); err != nil {
					t.Fatal(err)
				}
				return env.configDir(), env.configDir()
			},
		},
		{
			name: "settings file is a directory",
			setup: func(t *testing.T, env serviceTestEnvironment) (string, string) {
				t.Helper()
				if err := os.Mkdir(env.settingsPath(), 0o755); err != nil {
					t.Fatal(err)
				}
				return env.settingsPath(), filepath.Join(env.settingsPath(), "keep.txt")
			},
		},
	}
	operations := []struct {
		name string
		run  func(*Service) error
	}{
		{"Load", (*Service).Load},
		{"Update", func(s *Service) error {
			updated := s.Get()
			updated.Theme = "light"
			return s.Update(updated)
		}},
		{"SetFavoriteBenchmarks", func(s *Service) error {
			return s.SetFavoriteBenchmarks([]string{"replacement"})
		}},
	}
	for _, obstacle := range obstacles {
		t.Run(obstacle.name, func(t *testing.T) {
			for _, operation := range operations {
				t.Run(operation.name, func(t *testing.T) {
					env := newServiceTestEnvironment(t)
					service := NewService()
					before := env.defaults()
					before.FavoriteBenchmarks = []string{"keep"}
					before.ScenarioNotes = map[string]models.ScenarioNote{}
					before.SessionNotes = map[string]models.SessionNote{}
					if err := service.Update(before); err != nil {
						t.Fatal(err)
					}
					if err := os.Remove(env.settingsPath()); err != nil {
						t.Fatal(err)
					}
					errorPath, markerPath := obstacle.setup(t, env)
					marker := []byte("do not replace this filesystem obstacle")
					if err := os.WriteFile(markerPath, marker, 0o600); err != nil {
						t.Fatal(err)
					}

					err := operation.run(service)
					var pathErr *os.PathError
					if !errors.As(err, &pathErr) {
						t.Fatalf("%s error = %v, want *os.PathError", operation.name, err)
					}
					if pathErr.Path != errorPath {
						t.Errorf("error path = %q, want %q", pathErr.Path, errorPath)
					}
					if operation.name == "Load" {
						assertServiceSettings(t, service.Get(), before)
					}
					got, err := os.ReadFile(markerPath)
					if err != nil {
						t.Fatal(err)
					}
					if !bytes.Equal(got, marker) {
						t.Errorf("filesystem obstacle changed: got %q, want %q", got, marker)
					}
				})
			}
		})
	}
}

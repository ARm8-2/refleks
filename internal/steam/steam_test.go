package steam

import (
	"os"
	"path/filepath"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func writeSteamLoginUsers(t *testing.T, steamDir string) {
	t.Helper()
	configDir := filepath.Join(steamDir, "config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	const content = `"users"
{
	"76561198000000001"
	{
		"PersonaName"		"Detected Name"
		"MostRecent"		"1"
	}
}
`
	if err := os.WriteFile(filepath.Join(configDir, "loginusers.vdf"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestResolveIdentitySettingsWin(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv(constants.EnvSteamIDVar, "env-id")
	t.Setenv(constants.EnvPersonaNameVar, "env-name")

	s := models.Settings{SteamIDOverride: "settings-id", PersonaNameOverride: "settings-name"}
	if got := GetSteamID(s); got != "settings-id" {
		t.Errorf("GetSteamID = %q, want settings-id", got)
	}
	if got := GetPersonaName(s); got != "settings-name" {
		t.Errorf("GetPersonaName = %q, want settings-name", got)
	}
}

func TestResolveIdentityEnvFallback(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv(constants.EnvSteamIDVar, " env-id ")
	t.Setenv(constants.EnvPersonaNameVar, " env-name ")

	var s models.Settings
	if got := GetSteamID(s); got != "env-id" {
		t.Errorf("GetSteamID = %q, want env-id", got)
	}
	if got := GetPersonaName(s); got != "env-name" {
		t.Errorf("GetPersonaName = %q, want env-name", got)
	}
}

func TestResolveIdentityDetectsFromSteam(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv(constants.EnvSteamIDVar, "")
	t.Setenv(constants.EnvPersonaNameVar, "")

	steamDir := t.TempDir()
	writeSteamLoginUsers(t, steamDir)

	s := models.Settings{SteamInstallDir: steamDir}
	if got := GetSteamID(s); got != "76561198000000001" {
		t.Errorf("GetSteamID = %q, want detected id", got)
	}
	if got := GetPersonaName(s); got != "Detected Name" {
		t.Errorf("GetPersonaName = %q, want detected name", got)
	}
}

func TestResolveIdentityMixedSources(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv(constants.EnvSteamIDVar, "")
	t.Setenv(constants.EnvPersonaNameVar, "")

	steamDir := t.TempDir()
	writeSteamLoginUsers(t, steamDir)

	// A configured Steam ID can be combined with a detected persona name.
	s := models.Settings{SteamIDOverride: "settings-id", SteamInstallDir: steamDir}
	if got := GetSteamID(s); got != "settings-id" {
		t.Errorf("GetSteamID = %q, want settings-id", got)
	}
	if got := GetPersonaName(s); got != "Detected Name" {
		t.Errorf("GetPersonaName = %q, want detected name", got)
	}
}

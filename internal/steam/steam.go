package steam

import (
	"strings"

	"refleks/internal/constants"
	"refleks/internal/detect"
	"refleks/internal/models"
	"refleks/internal/settings"
)

// GetSteamID returns the Steam ID RefleK's uses for KovaaK's API calls.
// See resolveIdentity for the resolution priority order.
func GetSteamID(s models.Settings) string {
	id, _ := resolveIdentity(s)
	return id
}

// GetPersonaName returns the persona name RefleK's uses for KovaaK's API calls.
// See resolveIdentity for the resolution priority order.
func GetPersonaName(s models.Settings) string {
	_, name := resolveIdentity(s)
	return name
}

// resolveIdentity returns the Steam account identity to use for KovaaK's API
// calls and run metadata. Priority order per field:
// 1) the value stored in settings (auto-detected defaults fill these in)
// 2) environment variable override (e.g., dev containers/CI)
// 3) the MostRecent user in Steam's loginusers.vdf
// Fields resolve independently, so a stored Steam ID can be combined with a
// detected persona name and vice versa.
func resolveIdentity(s models.Settings) (steamID, personaName string) {
	steamID = strings.TrimSpace(s.SteamIDOverride)
	personaName = strings.TrimSpace(s.PersonaNameOverride)
	if steamID == "" {
		steamID = strings.TrimSpace(settings.GetEnv(constants.EnvSteamIDVar))
	}
	if personaName == "" {
		personaName = strings.TrimSpace(settings.GetEnv(constants.EnvPersonaNameVar))
	}

	// Both fields are already configured; nothing left to detect.
	if steamID != "" && personaName != "" {
		return steamID, personaName
	}

	// Fill any remaining field from the MostRecent user in loginusers.vdf.
	id, name := detect.SteamAccount(s.SteamInstallDir)
	if steamID == "" {
		steamID = id
	}
	if personaName == "" {
		personaName = name
	}
	return steamID, personaName
}

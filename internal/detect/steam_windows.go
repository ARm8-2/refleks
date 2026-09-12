//go:build windows

package detect

import (
	"golang.org/x/sys/windows/registry"
)

const (
	// Steam records its install location in the current user's registry.
	steamRegistryKey   = `Software\Valve\Steam`
	steamRegistryValue = "SteamPath"
)

// steamInstallDir locates Steam from the value Steam itself writes to the
// registry, which stays accurate even when Steam is installed outside Program
// Files or moved after installation.
func steamInstallDir() string {
	k, err := registry.OpenKey(registry.CURRENT_USER, steamRegistryKey, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer k.Close()

	dir, _, err := k.GetStringValue(steamRegistryValue)
	if err != nil {
		return ""
	}
	if !isSteamDir(dir) {
		return ""
	}
	return cleanDir(dir)
}

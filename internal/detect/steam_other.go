//go:build !windows

package detect

import (
	"os"
	"path/filepath"
)

// steamInstallDir probes the conventional Steam install locations on Linux and
// macOS. RefleK's targets Windows, but these paths keep development machines
// and containers working when a real Steam installation is present.
func steamInstallDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	candidates := []string{
		filepath.Join(home, ".local", "share", "Steam"),
		filepath.Join(home, ".steam", "steam"),
		filepath.Join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam"),
		filepath.Join(home, "Library", "Application Support", "Steam"),
	}
	for _, dir := range candidates {
		if isSteamDir(dir) {
			return cleanDir(dir)
		}
	}
	return ""
}

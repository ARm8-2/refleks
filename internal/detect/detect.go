// Package detect locates installed applications and Steam account state by
// inspecting the machine instead of relying on fixed default paths. Detection
// is best-effort: functions return empty values when nothing can be found so
// callers can fall back to their own defaults.
package detect

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"refleks/internal/constants"
)

// SteamInstallDir locates the Steam installation directory on this machine, or
// returns "" when Steam could not be found. The actual lookup is OS-specific
// (registry on Windows, conventional install locations elsewhere).
func SteamInstallDir() string {
	return steamInstallDir()
}

// KovaaksInstallDir locates the KovaaK's game directory inside the libraries
// of the detected Steam installation, or returns "" when it cannot be found.
func KovaaksInstallDir() string {
	return KovaaksInstallDirInSteam(SteamInstallDir())
}

// KovaaksInstallDirInSteam locates the KovaaK's game directory inside a given
// Steam installation. It scans the Steam directory itself (which hosts the
// primary library) plus any additional libraries listed in
// steamapps/libraryfolders.vdf for <library>/steamapps/common/FPSAimTrainer.
func KovaaksInstallDirInSteam(steamDir string) string {
	for _, libraryRoot := range steamLibraryRoots(steamDir) {
		if dir := kovaaksDirInLibrary(libraryRoot); dir != "" {
			return dir
		}
	}
	return ""
}

// steamLibraryRoots returns the deduplicated library roots of a Steam
// installation, starting with the Steam directory itself and followed by any
// additional libraries declared in steamapps/libraryfolders.vdf.
func steamLibraryRoots(steamDir string) []string {
	steamDir = cleanDir(steamDir)
	if steamDir == "" {
		return nil
	}
	roots := []string{steamDir}
	seen := map[string]bool{strings.ToLower(steamDir): true}
	for _, root := range libraryFoldersFromVDF(filepath.Join(steamDir, "steamapps", "libraryfolders.vdf")) {
		key := strings.ToLower(root)
		if seen[key] {
			continue
		}
		seen[key] = true
		roots = append(roots, root)
	}
	return roots
}

// libraryFoldersFromVDF reads the "path" values from a Steam
// steamapps/libraryfolders.vdf file. It returns nil when the file is absent or
// unreadable.
func libraryFoldersFromVDF(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var roots []string
	for _, match := range libraryPathPattern.FindAllSubmatch(data, -1) {
		if root := cleanDir(unescapeVDF(string(match[1]))); root != "" {
			roots = append(roots, root)
		}
	}
	return roots
}

// libraryPathPattern matches the value of a "path" key inside a VDF file,
// tolerating escaped quotes and backslashes inside the value.
var libraryPathPattern = regexp.MustCompile(`(?m)^\s*"path"\s*"((?:[^"\\]|\\.)*)"`)

// unescapeVDF removes the backslash escapes Steam uses when writing Windows
// paths into VDF files ("C:\\Program Files\\Steam" -> "C:\Program Files\Steam").
// Strings without backslashes are returned unchanged.
func unescapeVDF(s string) string {
	if !strings.ContainsRune(s, '\\') {
		return s
	}
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			i++ // skip the escape character
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

// kovaaksDirInLibrary returns "<library>/steamapps/common/FPSAimTrainer" when
// KovaaK's is installed in the given Steam library root, or "" otherwise.
func kovaaksDirInLibrary(libraryRoot string) string {
	installDir := filepath.Join(libraryRoot, "steamapps", "common", constants.KovaaksDataDirName)
	if isKovaaksInstallDir(installDir) {
		return cleanDir(installDir)
	}
	return ""
}

// isKovaaksInstallDir verifies a directory looks like a KovaaK's install: the
// game executable is present, or the game has run at least once and created
// its data directory (FPSAimTrainer/) next to the executable.
func isKovaaksInstallDir(installDir string) bool {
	if info, err := os.Stat(filepath.Join(installDir, constants.KovaaksProcessName)); err == nil && !info.IsDir() {
		return true
	}
	info, err := os.Stat(filepath.Join(installDir, constants.KovaaksDataDirName))
	return err == nil && info.IsDir()
}

// isSteamDir verifies a candidate directory looks like a Steam installation.
// Steam keeps its library metadata (steamapps/) and per-user config (config/)
// in the install root on every platform.
func isSteamDir(dir string) bool {
	dir = cleanDir(dir)
	if dir == "" {
		return false
	}
	for _, marker := range []string{"steamapps", "config"} {
		if info, err := os.Stat(filepath.Join(dir, marker)); err == nil && info.IsDir() {
			return true
		}
	}
	return false
}

// cleanDir trims and cleans a candidate directory, returning "" for empty
// input. It only handles the path syntax of the current OS.
func cleanDir(dir string) string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return ""
	}
	return filepath.Clean(dir)
}

package traces

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"refleks/internal/models"
	appsettings "refleks/internal/settings"
)

// ScenarioData is a versioned container for per-scenario persisted data.
// Start small with MouseTrace but leave room for future fields.
type ScenarioData struct {
	Version      int                 `json:"version"`
	FileName     string              `json:"fileName"`
	ScenarioName string              `json:"scenarioName,omitempty"`
	DatePlayed   string              `json:"datePlayed,omitempty"`
	MouseTrace   []models.MousePoint `json:"mouseTrace,omitempty"`
}

// customDir optionally overrides the default traces directory.
var customDir string

// SetBaseDir sets a custom base directory for storing scenario trace data.
// The directory will be created on first use if it does not exist.
func SetBaseDir(dir string) {
	customDir = dir
}

// tracesDir returns the directory where per-scenario data files are stored.
func tracesDir() (string, error) {
	var dir string
	if strings.TrimSpace(customDir) != "" {
		dir = customDir
	} else {
		// Default to $HOME/.refleks/traces
		base, err := appsettings.DefaultTracesDir()
		if err != nil {
			return "", err
		}
		dir = base
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// sanitizeName converts an arbitrary filename into a safe file stem for JSON storage.
func sanitizeName(name string) string {
	// Keep base name only and replace any path separators with underscores.
	base := filepath.Base(name)
	base = strings.ReplaceAll(base, "/", "_")
	base = strings.ReplaceAll(base, "\\", "_")
	return base
}

// pathFor returns the full JSON path for the given scenario file name.
func pathFor(fileName string) (string, error) {
	dir, err := tracesDir()
	if err != nil {
		return "", err
	}
	stem := sanitizeName(fileName)
	// Replace common suffix, else just append .json
	if strings.HasSuffix(strings.ToLower(stem), " stats.csv") {
		stem = stem[:len(stem)-len(" stats.csv")] + ".json"
	} else if strings.HasSuffix(strings.ToLower(stem), ".csv") {
		stem = stem[:len(stem)-4] + ".json"
	} else if !strings.HasSuffix(strings.ToLower(stem), ".json") {
		stem = stem + ".json"
	}
	return filepath.Join(dir, stem), nil
}

// Save writes scenario data to disk (overwriting if exists).
func Save(sd ScenarioData) error {
	path, err := pathFor(sd.FileName)
	if err != nil {
		return err
	}
	sd.Version = 1
	b, err := json.MarshalIndent(sd, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}

// Load reads scenario data for the given stats file name.
func Load(fileName string) (ScenarioData, error) {
	path, err := pathFor(fileName)
	if err != nil {
		return ScenarioData{}, err
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return ScenarioData{}, err
	}
	var sd ScenarioData
	if err := json.Unmarshal(b, &sd); err != nil {
		return ScenarioData{}, err
	}
	return sd, nil
}

// Exists reports whether a persisted record exists for the given stats file name.
func Exists(fileName string) bool {
	path, err := pathFor(fileName)
	if err != nil {
		return false
	}
	if fi, err := os.Stat(path); err == nil && !fi.IsDir() {
		return true
	}
	return false
}

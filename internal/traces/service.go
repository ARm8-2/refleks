package traces

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"refleks/internal/models"
	appsettings "refleks/internal/settings"
)

// ScenarioData is a versioned container for per-scenario persisted data.
type ScenarioData struct {
	Version      int                 `json:"version"`
	FileName     string              `json:"fileName"`
	ScenarioName string              `json:"scenarioName,omitempty"`
	DatePlayed   string              `json:"datePlayed,omitempty"`
	MouseTrace   []models.MousePoint `json:"mouseTrace,omitempty"`
}

// Service manages storage of scenario trace data.
type Service struct {
	mu        sync.RWMutex
	customDir string
}

// NewService creates a new traces service.
func NewService() *Service {
	return &Service{}
}

// SetBaseDir sets a custom base directory for storing scenario trace data.
func (s *Service) SetBaseDir(dir string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.customDir = dir
}

// GetBaseDir returns the current base directory.
func (s *Service) GetBaseDir() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.customDir
}

// tracesDir returns the directory where per-scenario data files are stored.
func (s *Service) tracesDir() (string, error) {
	s.mu.RLock()
	dir := s.customDir
	s.mu.RUnlock()

	if strings.TrimSpace(dir) == "" {
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

// toTraceBaseName converts a stats filename (e.g. "Scenario - ... Stats.csv")
// to a trace base filename (e.g. "Scenario - ...").
func (s *Service) toTraceBaseName(original string) string {
	safeName := filepath.Base(original)
	ext := filepath.Ext(safeName)
	if ext != "" {
		safeName = strings.TrimSuffix(safeName, ext)
	}
	// Strip " Stats" suffix if present (KovaaK's export format)
	safeName = strings.TrimSuffix(safeName, " Stats")
	return safeName
}

// Exists checks if a trace file exists for the given scenario filename.
// Checks for .trace (binary) first, then .json (legacy).
func (s *Service) Exists(originalFileName string) bool {
	dir, err := s.tracesDir()
	if err != nil {
		return false
	}

	base := s.toTraceBaseName(originalFileName)

	// Check binary
	if _, err := os.Stat(filepath.Join(dir, base+".trace")); err == nil {
		return true
	}
	// Check legacy json
	if _, err := os.Stat(filepath.Join(dir, base+".json")); err == nil {
		return true
	}
	return false
}

// Save stores the trace data for a scenario.
// Uses the new binary format (.trace).
func (s *Service) Save(data ScenarioData) error {
	dir, err := s.tracesDir()
	if err != nil {
		return err
	}

	// Sanitize filename
	if data.FileName == "." || data.FileName == "/" {
		return nil // invalid
	}

	base := s.toTraceBaseName(data.FileName)
	path := filepath.Join(dir, base+".trace")

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return WriteBinary(f, data)
}

// Load retrieves trace data for a scenario filename.
// Tries binary (.trace) first, then legacy JSON (.json).
func (s *Service) Load(originalFileName string) (ScenarioData, error) {
	dir, err := s.tracesDir()
	if err != nil {
		return ScenarioData{}, err
	}

	base := s.toTraceBaseName(originalFileName)

	// 1. Try Binary (.trace)
	path := filepath.Join(dir, base+".trace")
	if f, err := os.Open(path); err == nil {
		defer f.Close()
		return ReadBinary(f)
	}

	// 2. Try Legacy JSON (.json)
	path = filepath.Join(dir, base+".json")
	f, err := os.Open(path)
	if err != nil {
		return ScenarioData{}, err
	}
	defer f.Close()

	var data ScenarioData
	if err := json.NewDecoder(f).Decode(&data); err != nil {
		return ScenarioData{}, err
	}
	return data, nil
}

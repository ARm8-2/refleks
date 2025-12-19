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

// Exists checks if a trace file exists for the given scenario filename.
func (s *Service) Exists(originalFileName string) bool {
	dir, err := s.tracesDir()
	if err != nil {
		return false
	}

	safeName := filepath.Base(originalFileName)
	ext := filepath.Ext(safeName)
	if ext != "" {
		safeName = strings.TrimSuffix(safeName, ext)
	}
	safeName += ".json"

	path := filepath.Join(dir, safeName)
	_, err = os.Stat(path)
	return err == nil
}

// Save stores the trace data for a scenario.
func (s *Service) Save(data ScenarioData) error {
	dir, err := s.tracesDir()
	if err != nil {
		return err
	}

	// Sanitize filename
	safeName := filepath.Base(data.FileName)
	if safeName == "." || safeName == "/" {
		return nil // invalid
	}
	// Replace extension with .json
	ext := filepath.Ext(safeName)
	if ext != "" {
		safeName = strings.TrimSuffix(safeName, ext)
	}
	safeName += ".json"

	path := filepath.Join(dir, safeName)
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return json.NewEncoder(f).Encode(data)
}

// Load retrieves trace data for a scenario filename.
func (s *Service) Load(originalFileName string) (ScenarioData, error) {
	dir, err := s.tracesDir()
	if err != nil {
		return ScenarioData{}, err
	}

	safeName := filepath.Base(originalFileName)
	ext := filepath.Ext(safeName)
	if ext != "" {
		safeName = strings.TrimSuffix(safeName, ext)
	}
	safeName += ".json"

	path := filepath.Join(dir, safeName)
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

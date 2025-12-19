package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"refleks/internal/settings"
)

// Service manages application cache.
type Service struct {
	mu      sync.Mutex
	onClear []func()
}

// NewService creates a new cache service.
func NewService() *Service {
	return &Service{}
}

// RegisterOnClear registers a callback to be run when the cache is cleared.
func (s *Service) RegisterOnClear(fn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onClear = append(s.onClear, fn)
}

// ClearAll clears the cache directory and triggers registered callbacks.
func (s *Service) ClearAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir, err := settings.GetConfigDir()
	if err != nil {
		return err
	}
	cacheDir := filepath.Join(dir, "cache")

	// Remove all files in cache dir
	if err := os.RemoveAll(cacheDir); err != nil {
		return err
	}
	// Recreate empty dir
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return err
	}

	// Trigger callbacks
	for _, fn := range s.onClear {
		fn()
	}
	return nil
}

// Save writes the given data to a JSON file in the cache directory.
func (s *Service) Save(filename string, data any) error {
	dir, err := settings.GetConfigDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "cache", filename)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return json.NewEncoder(f).Encode(data)
}

// Load reads data from a JSON file in the cache directory.
func (s *Service) Load(filename string, dest any) error {
	dir, err := settings.GetConfigDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "cache", filename)

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return json.NewDecoder(f).Decode(dest)
}

// Exists checks if a cache file exists.
func (s *Service) Exists(filename string) bool {
	dir, err := settings.GetConfigDir()
	if err != nil {
		return false
	}
	path := filepath.Join(dir, "cache", filename)
	_, err = os.Stat(path)
	return err == nil
}

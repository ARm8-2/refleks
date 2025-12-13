package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"refleks/internal/settings"
)

var (
	mu sync.Mutex
	// OnClear is a list of callbacks to run when the cache is cleared.
	OnClear []func()
)

// RegisterOnClear registers a callback to be run when the cache is cleared.
func RegisterOnClear(fn func()) {
	mu.Lock()
	defer mu.Unlock()
	OnClear = append(OnClear, fn)
}

// Save writes the given data to a JSON file in the cache directory.
// filename should be relative to the cache directory (e.g. "benchmarks.json").
func Save(filename string, data any) error {
	mu.Lock()
	defer mu.Unlock()

	dir, err := settings.ConfigBaseDir()
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
func Load(filename string, dest any) error {
	mu.Lock()
	defer mu.Unlock()

	dir, err := settings.ConfigBaseDir()
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
func Exists(filename string) bool {
	mu.Lock()
	defer mu.Unlock()

	dir, err := settings.ConfigBaseDir()
	if err != nil {
		return false
	}
	path := filepath.Join(dir, "cache", filename)
	_, err = os.Stat(path)
	return err == nil
}

// Delete removes a cache file.
func Delete(filename string) error {
	mu.Lock()
	defer mu.Unlock()

	dir, err := settings.ConfigBaseDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "cache", filename)
	return os.Remove(path)
}

// ClearAll removes all files in the cache directory and runs registered callbacks.
func ClearAll() error {
	mu.Lock()
	defer mu.Unlock()

	// Run callbacks
	for _, fn := range OnClear {
		fn()
	}

	dir, err := settings.ConfigBaseDir()
	if err != nil {
		return err
	}
	cacheDir := filepath.Join(dir, "cache")
	return os.RemoveAll(cacheDir)
}

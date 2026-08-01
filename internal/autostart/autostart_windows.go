//go:build windows

package autostart

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	registryKey = `Software\Microsoft\Windows\CurrentVersion\Run`

	// valueName is the current autostart registry value. The app was renamed
	// from "RefleK's.exe" to "refleks.exe", so legacyValueName is removed
	// whenever the entry is synced; otherwise a pre-rename entry can keep
	// launching a binary that no longer exists after an update.
	valueName       = "refleks"
	legacyValueName = "RefleK's"
)

// Enable registers the running executable to start at login, optionally with
// args. It writes a single canonical entry and removes the legacy pre-rename
// value, keeping the registration migrated and idempotent.
func (s *Service) Enable(args string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	// Ensure we use the absolute path
	exePath, err := filepath.Abs(exe)
	if err != nil {
		return err
	}
	// Refuse to register a path that cannot be launched (e.g. running from a
	// location that was already removed) instead of writing an entry that
	// silently fails at login.
	if _, err := os.Stat(exePath); err != nil {
		return fmt.Errorf("autostart: current executable not found: %w", err)
	}

	k, _, err := registry.CreateKey(registry.CURRENT_USER, registryKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	cmd := `"` + exePath + `"`
	if args != "" {
		cmd += " " + args
	}

	if err := k.SetStringValue(valueName, cmd); err != nil {
		return err
	}
	return deleteIfPresent(k, legacyValueName)
}

// Disable removes the autostart registration. It is tolerant of an entry that
// is already absent and also clears the legacy pre-rename value.
func (s *Service) Disable() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		if errors.Is(err, registry.ErrNotExist) {
			return nil // Run key not present — nothing to disable
		}
		return err
	}
	defer k.Close()

	if err := deleteIfPresent(k, valueName); err != nil {
		return err
	}
	return deleteIfPresent(k, legacyValueName)
}

// IsEnabled reports whether an autostart registration exists.
func (s *Service) IsEnabled() (bool, error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryKey, registry.QUERY_VALUE)
	if err != nil {
		if errors.Is(err, registry.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	defer k.Close()

	_, _, err = k.GetStringValue(valueName)
	if errors.Is(err, registry.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// Sync reconciles the autostart registration with the desired state: it
// registers the running executable when enabled, and removes the entry
// (including any legacy value) when disabled.
func (s *Service) Sync(enabled bool, args string) error {
	if enabled {
		return s.Enable(args)
	}
	return s.Disable()
}

// deleteIfPresent removes a registry value, treating a missing value as a
// successful no-op.
func deleteIfPresent(k registry.Key, name string) error {
	err := k.DeleteValue(name)
	if errors.Is(err, registry.ErrNotExist) {
		return nil
	}
	return err
}

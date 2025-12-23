//go:build windows

package autostart

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	registryKey = `Software\Microsoft\Windows\CurrentVersion\Run`
	appName     = "RefleK's"
)

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

	k, err := registry.OpenKey(registry.CURRENT_USER, registryKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	cmd := `"` + exePath + `"`
	if args != "" {
		cmd += " " + args
	}

	return k.SetStringValue(appName, cmd)
}

func (s *Service) Disable() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	return k.DeleteValue(appName)
}

func (s *Service) IsEnabled() (bool, error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, registryKey, registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	defer k.Close()

	_, _, err = k.GetStringValue(appName)
	if err == registry.ErrNotExist {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

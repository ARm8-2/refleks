//go:build !windows
// +build !windows

package updater

import "errors"

func launchInstallerDetached(path string) error {
	return errors.New("auto-update currently supported on Windows only")
}

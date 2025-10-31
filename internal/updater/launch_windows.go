//go:build windows
// +build windows

package updater

import (
	"fmt"
	"path/filepath"
	"unsafe"

	"golang.org/x/sys/windows"
)

// SW constants for ShellExecuteW
const (
	SW_SHOWNORMAL = 1
)

var (
	modShell32        = windows.NewLazySystemDLL("shell32.dll")
	procShellExecuteW = modShell32.NewProc("ShellExecuteW")
)

// launchInstallerDetached uses ShellExecuteW with the "runas" verb so Windows will
// elevate if needed (UAC prompt) and run independently of the current process without
// spawning a visible console window.
func launchInstallerDetached(path string) error {
	dir := filepath.Dir(path)

	verbPtr, _ := windows.UTF16PtrFromString("runas")
	filePtr, _ := windows.UTF16PtrFromString(path)
	paramsPtr, _ := windows.UTF16PtrFromString("")
	dirPtr, _ := windows.UTF16PtrFromString(dir)

	r, _, callErr := procShellExecuteW.Call(
		0,
		uintptr(unsafe.Pointer(verbPtr)),
		uintptr(unsafe.Pointer(filePtr)),
		uintptr(unsafe.Pointer(paramsPtr)),
		uintptr(unsafe.Pointer(dirPtr)),
		uintptr(uint32(SW_SHOWNORMAL)),
	)
	// Per docs, return value > 32 indicates success
	if r <= 32 {
		if callErr != nil && callErr != windows.Errno(0) {
			return callErr
		}
		// Map a few common error codes for clearer logs
		switch r {
		case 2:
			return fmt.Errorf("ShellExecuteW: file not found: %s", path)
		case 3:
			return fmt.Errorf("ShellExecuteW: path not found: %s", path)
		case 5:
			return fmt.Errorf("ShellExecuteW: access denied (UAC cancelled?)")
		default:
			return fmt.Errorf("ShellExecuteW failed with code %d", r)
		}
	}
	return nil
}

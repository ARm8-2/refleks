//go:build windows

package process

import (
	"errors"
	"fmt"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// IsRunning reports whether a process with the given executable name exists.
// Probe errors are returned separately from a process that is not running.
func IsRunning(name string) (bool, error) {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return false, fmt.Errorf("CreateToolhelp32Snapshot: %w", err)
	}
	defer windows.CloseHandle(snapshot)

	var pe32 windows.ProcessEntry32
	pe32.Size = uint32(unsafe.Sizeof(pe32))

	if err := windows.Process32First(snapshot, &pe32); err != nil {
		if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
			return false, nil
		}
		return false, fmt.Errorf("Process32First: %w", err)
	}

	for {
		pName := windows.UTF16ToString(pe32.ExeFile[:])
		if strings.EqualFold(pName, name) {
			return true, nil
		}
		if err := windows.Process32Next(snapshot, &pe32); err != nil {
			if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
				return false, nil
			}
			return false, fmt.Errorf("Process32Next: %w", err)
		}
	}
}

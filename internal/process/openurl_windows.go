//go:build windows

package process

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modShell32        = windows.NewLazySystemDLL("shell32.dll")
	procShellExecuteW = modShell32.NewProc("ShellExecuteW")
)

// openURL opens the URL using ShellExecuteW with the "open" verb, which
// dispatches to the system's default handler for the URL's protocol scheme
// (e.g. steam://) without spawning any intermediate console process.
func openURL(url string) error {
	verbPtr, _ := windows.UTF16PtrFromString("open")
	urlPtr, _ := windows.UTF16PtrFromString(url)

	r, _, _ := procShellExecuteW.Call(
		0,
		uintptr(unsafe.Pointer(verbPtr)),
		uintptr(unsafe.Pointer(urlPtr)),
		0,
		0,
		1, // SW_SHOWNORMAL
	)
	// ShellExecuteW returns a value > 32 on success; values <= 32 are error codes.
	if r <= 32 {
		return fmt.Errorf("ShellExecuteW failed with code %d", r)
	}
	return nil
}

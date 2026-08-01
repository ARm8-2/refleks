//go:build windows

package elevation

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// CreateProcessWithTokenW is not exposed by x/sys/windows, so declare it
// directly as a fallback for the standard CreateProcessAsUserW path. Both
// APIs start the app under the user's normal (medium-integrity) token.
var (
	advapi32                    = windows.NewLazySystemDLL("advapi32.dll")
	procCreateProcessWithTokenW = advapi32.NewProc("CreateProcessWithTokenW")
)

const (
	logonWithProfile = 0x00000001
	createUnicodeEnv = 0x00000400
)

// IsElevated reports whether the current process runs with an elevated token.
func IsElevated() bool {
	return windows.GetCurrentProcessToken().IsElevated()
}

// RelaunchUnelevated restarts the current executable with the user's normal,
// non-elevated token and returns once the new process has been started. The
// caller is expected to exit afterwards; the new instance receives the same
// command-line arguments.
func RelaunchUnelevated() error {
	shellProc, err := openShellProcess()
	if err != nil {
		return err
	}
	defer windows.CloseHandle(shellProc)

	var shellToken windows.Token
	if err := windows.OpenProcessToken(shellProc, windows.TOKEN_DUPLICATE|windows.TOKEN_QUERY, &shellToken); err != nil {
		return err
	}
	defer shellToken.Close()

	var userToken windows.Token
	duplicateAccess := uint32(windows.TOKEN_ASSIGN_PRIMARY |
		windows.TOKEN_DUPLICATE |
		windows.TOKEN_QUERY |
		windows.TOKEN_ADJUST_DEFAULT |
		windows.TOKEN_ADJUST_SESSIONID)
	if err := windows.DuplicateTokenEx(shellToken, duplicateAccess,
		nil, windows.SecurityImpersonation, windows.TokenPrimary, &userToken); err != nil {
		return err
	}
	defer userToken.Close()
	if userToken.IsElevated() {
		return errors.New("desktop shell token is elevated")
	}

	exe, err := os.Executable()
	if err != nil {
		return err
	}

	var cmdLine []uint16
	{
		parts := []string{`"` + exe + `"`}
		parts = append(parts, os.Args[1:]...)
		var err error
		cmdLine, err = windows.UTF16FromString(strings.Join(parts, " "))
		if err != nil {
			return err
		}
	}

	var envBlock *uint16
	creationFlags := uint32(0)
	if err := windows.CreateEnvironmentBlock(&envBlock, userToken, false); err == nil {
		defer windows.DestroyEnvironmentBlock(envBlock)
		creationFlags |= createUnicodeEnv
	}

	var si windows.StartupInfo
	si.Cb = uint32(unsafe.Sizeof(si))
	var pi windows.ProcessInformation
	dir, err := filepath.Abs(filepath.Dir(exe))
	if err != nil {
		return err
	}
	dirPtr, err := windows.UTF16PtrFromString(dir)
	if err != nil {
		return err
	}

	// CreateProcessAsUserW requires SeIncreaseQuotaPrivilege for an elevated
	// caller. It is normally present but disabled in an administrator token;
	// enabling it here avoids making the result depend on the token's default
	// privilege state.
	_ = enablePrivilege("SeIncreaseQuotaPrivilege")

	// CreateProcessAsUserW is the standard Windows API for starting a process
	// from a different user's token. The duplicated explorer token is already
	// the user's normal-integrity primary token, so this drops the installer's
	// elevation before the app creates its Wails instance lock.
	if err := windows.CreateProcessAsUser(
		userToken,
		nil,
		&cmdLine[0],
		nil,
		nil,
		false,
		creationFlags,
		envBlock,
		dirPtr,
		&si,
		&pi,
	); err == nil {
		windows.CloseHandle(pi.Process)
		windows.CloseHandle(pi.Thread)
		return nil
	} else {
		// Some Windows policies deny CreateProcessAsUser but allow
		// CreateProcessWithTokenW. Enable the privilege required by that
		// fallback before trying it.
		_ = enablePrivilege("SeImpersonatePrivilege")
		if fallbackErr := createProcessWithToken(userToken, &cmdLine[0], creationFlags, envBlock, dirPtr, &si, &pi); fallbackErr != nil {
			return fmt.Errorf("create unelevated process: %w (token fallback: %v)", err, fallbackErr)
		}
	}
	windows.CloseHandle(pi.Process)
	windows.CloseHandle(pi.Thread)
	return nil
}

// openShellProcess returns a handle to the desktop shell (explorer.exe), which
// runs at the user's normal integrity level and is the source of a
// medium-integrity token.
func openShellProcess() (windows.Handle, error) {
	hwnd := windows.GetShellWindow()
	if hwnd == 0 {
		return 0, errors.New("desktop shell window not found")
	}
	var pid uint32
	if _, err := windows.GetWindowThreadProcessId(hwnd, &pid); err != nil {
		return 0, err
	}
	if pid == 0 {
		return 0, errors.New("desktop shell process not found")
	}
	proc, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return 0, fmt.Errorf("open shell process: %w", err)
	}
	return proc, nil
}

func createProcessWithToken(token windows.Token, cmdLine *uint16, creationFlags uint32, envBlock *uint16, dir *uint16, si *windows.StartupInfo, pi *windows.ProcessInformation) error {
	// CreateProcessWithTokenW is retained as a fallback for Windows policies
	// that grant the caller SeImpersonatePrivilege but deny CreateProcessAsUser.
	r, _, callErr := procCreateProcessWithTokenW.Call(
		uintptr(token),
		logonWithProfile,
		0,
		uintptr(unsafe.Pointer(cmdLine)),
		uintptr(creationFlags),
		uintptr(unsafe.Pointer(envBlock)),
		uintptr(unsafe.Pointer(dir)),
		uintptr(unsafe.Pointer(si)),
		uintptr(unsafe.Pointer(pi)),
	)
	if r == 0 {
		if callErr == nil {
			return errors.New("CreateProcessWithTokenW returned FALSE")
		}
		return callErr
	}
	return nil
}

func enablePrivilege(name string) error {
	namePtr, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return err
	}
	var luid windows.LUID
	if err := windows.LookupPrivilegeValue(nil, namePtr, &luid); err != nil {
		return err
	}
	tokenPrivileges := windows.Tokenprivileges{
		PrivilegeCount: 1,
		Privileges: [1]windows.LUIDAndAttributes{
			{Luid: luid, Attributes: windows.SE_PRIVILEGE_ENABLED},
		},
	}
	return windows.AdjustTokenPrivileges(
		windows.GetCurrentProcessToken(),
		false,
		&tokenPrivileges,
		0,
		nil,
		nil,
	)
}

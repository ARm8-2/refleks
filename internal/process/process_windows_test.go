//go:build windows

package process

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestIsRunningFindsCurrentProcess(t *testing.T) {
	executable, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable(): %v", err)
	}

	running, err := IsRunning(filepath.Base(executable))
	if err != nil {
		t.Fatalf("IsRunning(current executable): %v", err)
	}
	if !running {
		t.Fatal("IsRunning(current executable) = false, want true")
	}
}

func TestIsRunningReportsMissingProcess(t *testing.T) {
	name := fmt.Sprintf("refleks-test-missing-%d.exe", os.Getpid())
	running, err := IsRunning(name)
	if err != nil {
		t.Fatalf("IsRunning(%q): %v", name, err)
	}
	if running {
		t.Fatalf("IsRunning(%q) = true, want false", name)
	}
}

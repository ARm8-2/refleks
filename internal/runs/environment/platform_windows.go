//go:build windows

package environment

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows/registry"

	"refleks/internal/models"
)

type win32Processor struct {
	Name string
}

type win32VideoController struct {
	Name string
}

type win32ComputerSystem struct {
	TotalPhysicalMemory uint64
}

var (
	platformEnvOnce sync.Once
	platformEnvData models.RunEnvironment

	user32               = syscall.NewLazyDLL("user32.dll")
	gdi32                = syscall.NewLazyDLL("gdi32.dll")
	procGetSystemMetrics = user32.NewProc("GetSystemMetrics")
	procGetDC            = user32.NewProc("GetDC")
	procReleaseDC        = user32.NewProc("ReleaseDC")
	procGetDeviceCaps    = gdi32.NewProc("GetDeviceCaps")
)

const (
	smCXScreen = 0
	smCYScreen = 1
	vRefresh   = 116
)

func collectPlatformEnvironment(env *models.RunEnvironment, start, end time.Time) {
	_ = start
	_ = end

	platformEnvOnce.Do(func() {
		platformEnvData.OSVersion = readWindowsVersion()
		platformEnvData.CPUName, platformEnvData.CPUCores = readCPUInfo(platformEnvData.CPUCores)
		platformEnvData.GPUName = readGPUName()
		platformEnvData.RAMTotalMB = readRAMTotalMB()
		platformEnvData.ScreenWidth, platformEnvData.ScreenHeight = readScreenSize()
		platformEnvData.DisplayHz = readDisplayHz()
		// Determining true windowed/fullscreen mode at ingest time is not reliable.
		platformEnvData.IsWindowed = false
	})

	if env.OSVersion == "" {
		env.OSVersion = platformEnvData.OSVersion
	}
	if env.CPUName == "" {
		env.CPUName = platformEnvData.CPUName
	}
	if env.CPUCores <= 0 {
		env.CPUCores = platformEnvData.CPUCores
	}
	if env.GPUName == "" {
		env.GPUName = platformEnvData.GPUName
	}
	if env.RAMTotalMB <= 0 {
		env.RAMTotalMB = platformEnvData.RAMTotalMB
	}
	if env.ScreenWidth <= 0 {
		env.ScreenWidth = platformEnvData.ScreenWidth
	}
	if env.ScreenHeight <= 0 {
		env.ScreenHeight = platformEnvData.ScreenHeight
	}
	if env.DisplayHz <= 0 {
		env.DisplayHz = platformEnvData.DisplayHz
	}
	env.IsWindowed = platformEnvData.IsWindowed
}

func readWindowsVersion() string {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer k.Close()

	product, _, _ := k.GetStringValue("ProductName")
	displayVersion, _, _ := k.GetStringValue("DisplayVersion")
	if displayVersion == "" {
		displayVersion, _, _ = k.GetStringValue("ReleaseId")
	}
	build, _, _ := k.GetStringValue("CurrentBuildNumber")
	product = normalizeWindowsProductName(product, build)

	parts := make([]string, 0, 3)
	if v := strings.TrimSpace(product); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(displayVersion); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(build); v != "" {
		parts = append(parts, fmt.Sprintf("(%s)", v))
	}
	return strings.TrimSpace(strings.Join(parts, " "))
}

func normalizeWindowsProductName(product, build string) string {
	name := strings.TrimSpace(product)
	buildText := strings.TrimSpace(build)
	if name == "" || buildText == "" {
		return name
	}
	buildNum, err := strconv.Atoi(buildText)
	if err != nil {
		return name
	}
	if buildNum >= 22000 && strings.HasPrefix(name, "Windows 10") {
		return strings.Replace(name, "Windows 10", "Windows 11", 1)
	}
	return name
}

func readCPUInfo(defaultCores int32) (string, int32) {
	var rows []win32Processor
	if err := wmi.Query("SELECT Name FROM Win32_Processor", &rows); err != nil || len(rows) == 0 {
		return "", defaultCores
	}
	name := strings.TrimSpace(rows[0].Name)
	return name, defaultCores
}

func readGPUName() string {
	var rows []win32VideoController
	if err := wmi.Query("SELECT Name FROM Win32_VideoController", &rows); err != nil {
		return ""
	}
	for _, row := range rows {
		if name := strings.TrimSpace(row.Name); name != "" {
			return name
		}
	}
	return ""
}

func readRAMTotalMB() int32 {
	var rows []win32ComputerSystem
	if err := wmi.Query("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem", &rows); err != nil || len(rows) == 0 {
		return 0
	}
	mb := rows[0].TotalPhysicalMemory / (1024 * 1024)
	if mb > math.MaxInt32 {
		return math.MaxInt32
	}
	return int32(mb)
}

func readScreenSize() (int32, int32) {
	w, _, _ := procGetSystemMetrics.Call(smCXScreen)
	h, _, _ := procGetSystemMetrics.Call(smCYScreen)
	return int32(w), int32(h)
}

func readDisplayHz() float64 {
	hdc, _, _ := procGetDC.Call(0)
	if hdc == 0 {
		return 0
	}
	defer procReleaseDC.Call(0, hdc)

	hz, _, _ := procGetDeviceCaps.Call(hdc, vRefresh)
	if hz <= 1 {
		return 0
	}
	return float64(int32(hz))
}

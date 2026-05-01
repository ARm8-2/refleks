package environment

import (
	"runtime"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// CollectRunEnvironment assembles machine and input metadata captured for a run window.
func CollectRunEnvironment(mouse models.MouseTraceProvider, start, end time.Time, tracePoints int, steamID, personaName string) models.RunEnvironment {
	env := models.RunEnvironment{
		OS:          runtime.GOOS,
		Arch:        runtime.GOARCH,
		CPUCores:    int32(runtime.NumCPU()),
		AppVersion:  constants.AppVersion,
		SteamID:     strings.TrimSpace(steamID),
		PersonaName: strings.TrimSpace(personaName),
		TracePoints: int32(tracePoints),
		SampleRate:  int32(constants.DefaultMouseSampleHz),
	}
	if !start.IsZero() && !end.IsZero() && start.Before(end) {
		env.TraceDuration = end.Sub(start).Seconds()
	}

	collectPlatformEnvironment(&env, start, end)

	if mouse == nil || start.IsZero() || end.IsZero() || !start.Before(end) {
		return env
	}

	meta := mouse.GetRunMetadata(start, end)
	env.MouseVID = normalizeHex4(meta.VendorID)
	env.MousePID = normalizeHex4(meta.ProductID)
	env.MouseMI = normalizeHex2(meta.InterfaceNumber)
	env.MouseName = strings.TrimSpace(meta.DeviceName)
	env.MouseBackend = normalizeBackend(meta.Backend)
	if meta.SampleRateHz > 0 {
		env.SampleRate = meta.SampleRateHz
	}

	return env
}

func normalizeBackend(s string) string {
	v := strings.ToLower(strings.TrimSpace(s))
	if v == "" {
		return "unknown"
	}
	v = strings.ReplaceAll(v, "_", "")
	v = strings.ReplaceAll(v, "-", "")
	return v
}

func normalizeHex4(s string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	s = strings.TrimPrefix(s, "0X")
	if len(s) != 4 {
		return ""
	}
	for _, ch := range s {
		if (ch < '0' || ch > '9') && (ch < 'A' || ch > 'F') {
			return ""
		}
	}
	return s
}

func normalizeHex2(s string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	s = strings.TrimPrefix(s, "0X")
	if len(s) != 2 {
		return ""
	}
	for _, ch := range s {
		if (ch < '0' || ch > '9') && (ch < 'A' || ch > 'F') {
			return ""
		}
	}
	return s
}

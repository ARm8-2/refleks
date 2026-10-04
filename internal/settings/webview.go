package settings

import (
	"strings"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// WebviewGPUDisabled reports whether WebView2 GPU acceleration should be
// turned off for this launch. Some GPU/driver combinations render the window
// completely black, which also hides the Settings page, so the persisted
// setting is backed by two startup-level escape hatches: the
// --disable-webview-gpu command-line flag and the REFLEKS_DISABLE_WEBVIEW_GPU
// environment variable (also read from ~/.refleks/.env).
func WebviewGPUDisabled(cliFlag bool, s models.Settings) bool {
	return cliFlag || s.DisableWebviewGPU || isTruthy(GetEnv(constants.EnvDisableWebviewGPUVar))
}

func isTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

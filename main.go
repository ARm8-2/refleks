package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"refleks/internal/constants"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	monitor := flag.Bool("monitor", false, "Start in monitor mode (hidden)")
	flag.Parse()

	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "RefleK's",
		Width:  1500,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: replayAssetHandler(),
		},
		BackgroundColour:   &options.RGBA{R: 0, G: 0, B: 0, A: 1},
		OnStartup:          app.startup,
		OnShutdown:         app.shutdown,
		StartHidden:        *monitor,
		LogLevel:           logger.DEBUG,
		LogLevelProduction: logger.ERROR,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "app.refleks.desktop",
			OnSecondInstanceLaunch: func(secondInstanceData options.SecondInstanceData) {
				app.ShowWindow()
			},
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			if app.shouldRunInBackground() {
				app.hideWindow()
				return true
			}
			return false
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		// Wails did not start, so no runtime context/logger exists yet.
		fmt.Fprintln(os.Stderr, "Error:", err)
	}
}

// replayAssetHandler serves video replay files from ~/.refleks/replays/ over HTTP.
func replayAssetHandler() http.Handler {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	return replayAssetHandlerForDir(filepath.Join(home, constants.ConfigDirName, constants.ReplaysSubdirName))
}

// replayAssetHandlerForDir serves files directly from disk. http.ServeFile
// uses a seekable *os.File, so Chromium receives normal HTTP byte ranges for
// metadata, playback, and scrubbing without Go ever reading a replay in full.
func replayAssetHandlerForDir(replaysDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/replays/") {
			http.NotFound(w, r)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/replays/")
		// Serve exactly one decoded filename component. The URL is generated via
		// PathEscape, but validate again before mapping it into the replay folder.
		if name == "" || filepath.Base(name) != name || strings.Contains(name, "\\") ||
			(filepath.Ext(name) != ".mp4" && filepath.Ext(name) != ".webm") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		// Replay URLs include a file-content version from App.resolveReplayPath,
		// so cached byte ranges remain valid for this immutable URL while a
		// replacement naturally receives a new URL. Allowing private caching
		// avoids repeated disk reads during nearby seeks without exposing clips
		// to shared caches.
		w.Header().Set("Cache-Control", "private, max-age=3600")
		filePath := filepath.Join(replaysDir, name)
		http.ServeFile(w, r, filePath)
	})
}

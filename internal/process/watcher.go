package process

import (
	"context"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Watcher monitors for a process and triggers callbacks on state changes.
type Watcher struct {
	processName string
	onStart     func()
	onStop      func()
}

// NewWatcher creates a watcher that calls onStart when the process appears
// and onStop when it disappears. Pass nil for unused callbacks.
func NewWatcher(processName string, onStart, onStop func()) *Watcher {
	return &Watcher{
		processName: processName,
		onStart:     onStart,
		onStop:      onStop,
	}
}

func (w *Watcher) Start(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	// Immediate initial check so tracking isn't delayed by the first poll interval.
	// When the mouse tracker starts after this watcher (e.g. user toggles tracking
	// ON while KovaaK's is already running), this prevents a ~3 second dead window
	// where runs would be ingested without trace data.
	observed, err := IsRunning(w.processName)
	running, started, _ := processTransition(false, observed, err)
	lastCheckError := ""
	if err != nil {
		runtime.LogWarningf(ctx, "process watcher: check for %q failed: %v", w.processName, err)
		lastCheckError = err.Error()
	} else {
		runtime.LogDebugf(ctx, "process watcher: initial check for %q: running=%v", w.processName, running)
	}
	if started && w.onStart != nil {
		w.onStart()
	}

	for {
		select {
		case <-ctx.Done():
			runtime.LogDebugf(ctx, "process watcher: stopped monitoring %q", w.processName)
			return
		case <-ticker.C:
			observed, err := IsRunning(w.processName)
			nextRunning, started, stopped := processTransition(running, observed, err)
			if err != nil {
				// A failed snapshot is not proof that the process exited. Keep the
				// last known state so a transient Windows API error cannot stop both
				// capture pipelines.
				if err.Error() != lastCheckError {
					runtime.LogWarningf(ctx, "process watcher: check for %q failed: %v", w.processName, err)
					lastCheckError = err.Error()
				}
				running = nextRunning
				continue
			}
			if lastCheckError != "" {
				runtime.LogDebugf(ctx, "process watcher: check for %q recovered", w.processName)
				lastCheckError = ""
			}

			if nextRunning != running {
				runtime.LogDebugf(ctx, "process watcher: %q running state changed %v -> %v", w.processName, running, nextRunning)
			}
			if started && w.onStart != nil {
				w.onStart()
			} else if stopped && w.onStop != nil {
				w.onStop()
			}

			running = nextRunning
		}
	}
}

func processTransition(wasRunning, observed bool, probeErr error) (nextRunning, started, stopped bool) {
	if probeErr != nil {
		return wasRunning, false, false
	}
	if wasRunning == observed {
		return wasRunning, false, false
	}
	return observed, observed, !observed
}

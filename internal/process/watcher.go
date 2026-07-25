package process

import (
	"context"
	"time"
)

// Watcher monitors for a process and triggers callbacks on state changes.
type Watcher struct {
	processName string
	onStart     func()
	onStop      func()
}

// IsRunning reports whether a process with the given executable name exists.
func IsRunning(processName string) bool {
	return processIsRunning(processName)
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
	running := processIsRunning(w.processName)
	if running && w.onStart != nil {
		w.onStart()
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			currentlyRunning := processIsRunning(w.processName)

			if currentlyRunning && !running {
				if w.onStart != nil {
					w.onStart()
				}
			} else if !currentlyRunning && running {
				if w.onStop != nil {
					w.onStop()
				}
			}

			running = currentlyRunning
		}
	}
}

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

	// Initial check to populate state, but don't fire events yet?
	// Or fire events immediately if running?
	// Existing logic initialized running=false, so it FIRES onStart if running.
	running := false

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			currentlyRunning := isRunning(w.processName)

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

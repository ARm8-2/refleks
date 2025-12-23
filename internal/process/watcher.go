package process

import (
	"context"
	"time"
)

// Watcher monitors for a process and triggers a callback when it starts.
type Watcher struct {
	processName string
	onStart     func()
}

func NewWatcher(processName string, onStart func()) *Watcher {
	return &Watcher{
		processName: processName,
		onStart:     onStart,
	}
}

func (w *Watcher) Start(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

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
			}
			running = currentlyRunning
		}
	}
}

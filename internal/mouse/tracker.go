package mouse

import (
	"time"

	"refleks/internal/models"
)

// Provider exposes a time-windowed mouse trace store.
// Implementations may be OS-specific; on non-Windows platforms, this is a no-op.
// All methods are safe for concurrent use.
type Provider interface {
	// Start begins sampling (if supported on this platform). No-op if already running.
	Start() error
	// Stop stops sampling and clears internal state as needed. No-op if not running.
	Stop()
	// SetBufferDuration sets the retention window; samples older than now-d are pruned.
	SetBufferDuration(d time.Duration)
	// Enabled reports whether sampling is active and supported on this platform.
	Enabled() bool
	// GetRange returns a copy of samples in [start, end]. Returns empty slice when disabled.
	GetRange(start, end time.Time) []models.MousePoint
}

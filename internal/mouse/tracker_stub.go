//go:build !windows

package mouse

import (
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
)

type trackerNoop struct {
	bufDur time.Duration
}

// New returns a no-op tracker on non-Windows platforms.
func New(sampleHz int) Provider {
	return &trackerNoop{bufDur: time.Duration(constants.DefaultMouseBufferMinutes) * time.Minute}
}

func (t *trackerNoop) Start() error                                      { return nil }
func (t *trackerNoop) Stop()                                             {}
func (t *trackerNoop) SetBufferDuration(d time.Duration)                 { t.bufDur = d }
func (t *trackerNoop) Enabled() bool                                     { return false }
func (t *trackerNoop) GetRange(start, end time.Time) []models.MousePoint { return nil }

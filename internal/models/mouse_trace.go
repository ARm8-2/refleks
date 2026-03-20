package models

import "time"

// MouseTraceProvider exposes the mouse trace needed while ingesting a scenario.
type MouseTraceProvider interface {
	Enabled() bool
	GetRange(start, end time.Time) []MousePoint
}

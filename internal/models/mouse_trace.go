package models

import "time"

// MouseRunMetadata describes the source device associated with a run trace window.
type MouseRunMetadata struct {
	Backend         string
	DeviceName      string
	VendorID        string
	ProductID       string
	InterfaceNumber string
	SampleRateHz    int32
}

// MouseTraceProvider exposes the mouse trace needed while ingesting a scenario.
type MouseTraceProvider interface {
	Enabled() bool
	GetRange(start, end time.Time) []MousePoint
	GetRunMetadata(start, end time.Time) MouseRunMetadata
}

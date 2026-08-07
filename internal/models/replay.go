package models

// Replay processing states are returned to the history UI so it can distinguish
// an active trim from a run that was never captured or failed during export.
const (
	ReplayStateProcessing  = "processing"
	ReplayStateReady       = "ready"
	ReplayStateUnavailable = "unavailable"
	ReplayStateFailed      = "failed"
)

type ReplayStatus struct {
	State string `json:"state"`
	UserMessage
}

package constants

import "errors"

// Message codes identify user-facing messages that cross the backend/frontend
// boundary. The frontend resolves a code to a localized string via its message
// catalog (frontend/src/shared/lib/i18n/messages/*/errors.ts). Keep codes in
// the same "<domain>:<name>" style as the event names in events.go.
const (
	// Replay status messages (internal/runs).
	ReplayProcessing         = "replay:processing"
	ReplayReady              = "replay:ready"
	ReplayNoCaptureSession   = "replay:noCaptureSession"
	ReplayNoSessionCoverage  = "replay:noSessionCoverage"
	ReplayOutsideSession     = "replay:outsideSession"
	ReplayCaptureStopped     = "replay:captureStopped"
	ReplayProcessingFailed   = "replay:processingFailed"
	ReplaySegmentsMissing    = "replay:segmentsMissing"
	ReplayTrimTimedOut       = "replay:trimTimedOut"
	ReplayStorageUnavailable = "replay:storageUnavailable"
	ReplayMissing            = "replay:missing"
	ReplayExportFailed       = "replay:exportFailed"

	// Screen capture status messages (internal/runs/screen).
	ScreenCaptureStarting      = "screenCapture:starting"
	ScreenCaptureActive        = "screenCapture:active"
	ScreenCaptureUninitialized = "screenCapture:uninitialized"

	// Updater errors (internal/updater).
	UpdateCheckFailed    = "update:checkFailed"
	UpdateDownloadFailed = "update:downloadFailed"
	UpdateUnsupportedOS  = "update:unsupportedOS"

	// App service errors.
	AutostartUpdateFailed  = "autostart:updateFailed"
	BenchmarkProgressFetch = "benchmark:progressFetchFailed"
	ScenarioScoresFetch    = "scenario:scoresFetchFailed"
)

// CodedError attaches a stable message code to an error. Error() renders
// "<code>: <detail>" so the frontend can extract the code and localize the
// message while keeping the underlying detail for logs.
type CodedError struct {
	Code string
	Err  error
}

func (e *CodedError) Error() string {
	if e.Err == nil {
		return e.Code
	}
	return e.Code + ": " + e.Err.Error()
}

// Unwrap exposes the underlying error for errors.Is/As.
func (e *CodedError) Unwrap() error { return e.Err }

// NewCoded builds a coded error without an underlying cause.
func NewCoded(code string) error { return &CodedError{Code: code} }

// WrapCoded attaches a code to an existing error, preserving the detail for
// logging. Already-coded errors pass through untouched.
func WrapCoded(code string, err error) error {
	if err == nil {
		return nil
	}
	var coded *CodedError
	if errors.As(err, &coded) {
		return err
	}
	return &CodedError{Code: code, Err: err}
}

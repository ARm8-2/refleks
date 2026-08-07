package screen

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// CaptureConfig contains all settings that affect a capture session. A
// provider reads this configuration when Start is called; changing it while a
// session is active is intentionally handled by the runtime as a session
// rotation so the encoded stream cannot mix formats.
type CaptureConfig struct {
	FPS        int
	Resolution string
	Encoder    string
}

const (
	CaptureStateIdle        = "idle"
	CaptureStateStarting    = "starting"
	CaptureStateCapturing   = "capturing"
	CaptureStateError       = "error"
	CaptureStateUnsupported = "unsupported"
)

// ProviderStatus reports the health of the active capture session independently
// of whether FFmpeg is installed or an encoder is available.
type ProviderStatus struct {
	Active             bool
	Healthy            bool
	State              string
	Message            string
	LastError          string
	LastFrameUnixMilli int64
}

// CaptureStatus combines encoder availability with the health of the actual
// capture session. Encoder probing alone is not sufficient to claim capture is
// working because D3D11 and the long-lived FFmpeg process start later.
type CaptureStatus struct {
	EncoderName string `json:"encoderName"`
	Container   string `json:"container"`
	IsHardware  bool   `json:"isHardware"`
	Available   bool   `json:"available"`
	Active      bool   `json:"active"`
	Healthy     bool   `json:"healthy"`
	State       string `json:"state"`
	models.UserMessage
	LastFrameUnixMilli int64 `json:"lastFrameUnixMilli,omitempty"`
}

// Provider captures screen frames into a rolling buffer of short segments
// with minimal performance impact. Frames are piped to an ffmpeg subprocess
// during capture with a bounded frame pool and one latest-frame cache for
// unchanged desktop frames. Segments are written to disk
// independently (like a game-capture "instant replay" buffer) so that a run's
// footage becomes available for trimming within seconds of the run ending,
// and so a long play session never grows a single unbounded recording file.
// On non-Windows platforms this is a no-op stub.
type Provider interface {
	// Configure stores the settings for the next capture session. The runtime
	// must stop and start the provider to apply changes to an active session.
	Configure(CaptureConfig)
	// SetFailureHandler receives unrecoverable runtime failures, such as a lost
	// desktop-duplication device or an FFmpeg process that exits unexpectedly.
	SetFailureHandler(func(error))
	// Status reports whether the current session is actively producing frames.
	Status() ProviderStatus
	// Start begins frame capture. No-op if already running or unsupported.
	Start() error
	// Stop ends frame capture. No-op if not running. The most recently
	// completed session's segments remain available (and are still pruned by
	// the retention window) until ReleaseSession is called.
	Stop()
	// Enabled reports whether capture is active.
	Enabled() bool
	// Session returns the directory holding the current (or most recently
	// stopped) capture session's rolling segments, and the wall-clock time
	// recording began. Empty dir if no capture has ever started.
	Session() (dir string, startedAt time.Time)
	// Segments returns the absolute paths of finalized (fully written,
	// trim-safe) segment files within dir whose time range overlaps
	// [start, end), in chronological order. firstSegmentStart is the selected
	// list's offset relative to sessionStart. The concat demuxer rebases that
	// list to zero, so callers must use this offset when trimming. sessionStart
	// must be the value returned by Session() for this dir. ready is false when
	// the segment needed to cover `end` has not finished writing yet — callers
	// should wait and retry rather than trim a partial/still-open segment.
	Segments(dir string, sessionStart, start, end time.Time) (paths []string, firstSegmentStart time.Duration, ready bool)
	// ReleaseSegments releases the temporary retention leases acquired by
	// Segments. Call it once the caller has finished reading the selected files.
	ReleaseSegments(paths []string)
	// ReleaseSession removes a capture session's temp directory and all its
	// segments once every run referencing it has been handled.
	ReleaseSession(dir string)
}

// Encoder compresses captured frames into a video file.
type Encoder struct {
	ffmpegPath       string
	encoderName      string
	container        string // ".mp4" or ".webm"
	probeOnce        sync.Once
	probeDiagnostics string // diagnostics collected during encoder selection
}

// EncoderInfo describes the selected encoder.
type EncoderInfo struct {
	EncoderName string `json:"encoderName"` // e.g. "hevc_nvenc"
	Container   string `json:"container"`   // e.g. ".mp4"
	IsHardware  bool   `json:"isHardware"`
}

// CleanupAbandonedSessions removes capture directories left in the OS temp
// directory by an interrupted app shutdown. It is deliberately called on app
// startup before a new session can exist; normal sessions are released only
// after their trims finish.
func CleanupAbandonedSessions() error {
	return cleanupAbandonedSessions(os.TempDir())
}

func cleanupAbandonedSessions(tempDir string) error {
	entries, err := os.ReadDir(tempDir)
	if err != nil {
		return err
	}

	var errs []error
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), constants.ScreenCaptureTempDirPrefix) {
			continue
		}
		if err := os.RemoveAll(filepath.Join(tempDir, entry.Name())); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

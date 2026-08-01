package screen

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Provider captures screen frames into a rolling buffer of short segments
// with minimal performance impact. Frames are piped to an ffmpeg subprocess
// during capture — no in-memory buffering. Segments are written to disk
// independently (like a game-capture "instant replay" buffer) so that a run's
// footage becomes available for trimming within seconds of the run ending,
// and so a long play session never grows a single unbounded recording file.
// On non-Windows platforms this is a no-op stub.
type Provider interface {
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
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "refleks-capture-") {
			continue
		}
		if err := os.RemoveAll(filepath.Join(tempDir, entry.Name())); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// SetCaptureEncoder configures the encoder name that the capture subprocess
// will use for real-time encoding.  If never called, defaults to libx264.
func SetCaptureEncoder(p Provider, encName string) {
	if c, ok := p.(interface{ SetEncoder(string) }); ok {
		c.SetEncoder(encName)
	}
}

// SetCaptureFPS configures the recording frame rate.
func SetCaptureFPS(p Provider, fps int) {
	if c, ok := p.(interface{ SetFPS(int) }); ok {
		c.SetFPS(fps)
	}
}

// SetCaptureResolution configures the recording resolution (e.g. "native", "1080", "900", "720").
func SetCaptureResolution(p Provider, res string) {
	if c, ok := p.(interface{ SetResolution(string) }); ok {
		c.SetResolution(res)
	}
}

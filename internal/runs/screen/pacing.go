package screen

import (
	"sync"
	"time"
)

// frameClock keeps the encoded media timeline locked to wall-clock time.
//
// FFmpeg's rawvideo demuxer timestamps each frame from its index and the
// requested input framerate, so media time advances only when a frame is
// written. If the producer emits fewer frames than the configured rate — a
// static desktop, dropped frames under encoder backpressure, a slow capture
// path — media time falls behind wall time. Every wall-clock-to-media-time
// calculation in the trim path assumes the two are identical, so accumulated
// lag silently shifts replays later while preserving their duration.
//
// frameClock removes that assumption. The capture loop asks how many frames
// are due at the current wall time, pads the difference with the latest frame,
// and emits nothing when it is ahead. Frame count therefore tracks elapsed
// wall time even when the screen is not changing or a frame is dropped.
//
// A frameClock is safe for concurrent use: the capture loop advances it while
// diagnostics may sample it.
type frameClock struct {
	mu      sync.Mutex
	fps     int
	start   time.Time
	emitted int64
}

func newFrameClock(fps int, start time.Time) *frameClock {
	return &frameClock{fps: fps, start: start}
}

// due returns how many frames must be emitted now to keep media time aligned
// with wall time. The frame at the anchor instant is frame zero, so a freshly
// anchored clock reports one frame due.
func (c *frameClock) due(now time.Time) int64 {
	if c == nil {
		return 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.fps <= 0 || c.start.IsZero() {
		return 0
	}
	if now.Before(c.start) {
		return 1
	}
	target := int64(now.Sub(c.start).Seconds()*float64(c.fps)) + 1
	if target <= c.emitted {
		return 0
	}
	return target - c.emitted
}

// frameEmitted records one frame handed to the encoder.
func (c *frameClock) frameEmitted() {
	if c == nil {
		return
	}
	c.mu.Lock()
	c.emitted++
	c.mu.Unlock()
}

// frameClockStats is a consistent diagnostic snapshot of a frameClock.
// It is read by the periodic pacing log.
type frameClockStats struct {
	Emitted int64
	Media   time.Duration // wall position of the newest emitted frame
	Wall    time.Duration // wall time since the clock was anchored
	Skew    time.Duration // Wall - Media; positive means media is behind
}

func (c *frameClock) stats(now time.Time) frameClockStats {
	if c == nil {
		return frameClockStats{}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	var s frameClockStats
	if c.fps <= 0 || c.start.IsZero() {
		return s
	}
	s.Emitted = c.emitted
	if c.emitted > 0 {
		// Frame zero sits at media t=0, so the newest frame's position is
		// (emitted-1)/fps rather than emitted/fps.
		s.Media = time.Duration(float64(c.emitted-1) / float64(c.fps) * float64(time.Second))
	}
	s.Wall = now.Sub(c.start)
	if s.Wall < 0 {
		s.Wall = 0
	}
	s.Skew = s.Wall - s.Media
	return s
}

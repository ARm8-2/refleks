package screen

import "sync"

// processLogLimit bounds diagnostics retained from a long-running ffmpeg
// process. ffmpeg can emit warnings indefinitely; retaining all of stderr
// would otherwise make an hours-long capture grow the Go heap without bound.
const processLogLimit = 64 * 1024

// tailBuffer is a concurrency-safe io.Writer that retains only the newest
// bytes. It is intended for diagnostics, not media data.
type tailBuffer struct {
	mu        sync.Mutex
	buf       []byte
	truncated bool
}

func (b *tailBuffer) Write(p []byte) (int, error) {
	originalLen := len(p)
	if originalLen == 0 {
		return 0, nil
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	if len(p) >= processLogLimit {
		b.buf = append(b.buf[:0], p[len(p)-processLogLimit:]...)
		b.truncated = true
		return originalLen, nil
	}

	overflow := len(b.buf) + len(p) - processLogLimit
	if overflow > 0 {
		copy(b.buf, b.buf[overflow:])
		b.buf = b.buf[:len(b.buf)-overflow]
		b.truncated = true
	}
	b.buf = append(b.buf, p...)
	return originalLen, nil
}

func (b *tailBuffer) Reset() {
	b.mu.Lock()
	b.buf = b.buf[:0]
	b.truncated = false
	b.mu.Unlock()
}

func (b *tailBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.truncated {
		return string(b.buf)
	}
	return "[ffmpeg output truncated]\n" + string(b.buf)
}

package screen

import (
	"strings"
	"testing"
	"time"
)

func TestSelectSegmentRange(t *testing.T) {
	seg := func(path string, start, end float64) segmentEntry {
		return segmentEntry{path: path, startSec: start, endSec: end}
	}

	tests := []struct {
		name        string
		entries     []segmentEntry
		windowStart float64
		windowEnd   float64
		wantPaths   []string
		wantFirst   float64
		wantCovered bool
	}{
		{
			name:        "empty",
			entries:     nil,
			windowStart: 0,
			windowEnd:   1,
		},
		{
			name:        "inverted window",
			entries:     []segmentEntry{seg("a", 0, 10)},
			windowStart: 5,
			windowEnd:   5,
		},
		{
			name:        "single segment covers window",
			entries:     []segmentEntry{seg("a", 0, 10)},
			windowStart: 2,
			windowEnd:   8,
			wantPaths:   []string{"a"},
			wantFirst:   0,
			wantCovered: true,
		},
		{
			name:        "contiguous segments",
			entries:     []segmentEntry{seg("a", 0, 5), seg("b", 5, 10), seg("c", 10, 15)},
			windowStart: 2,
			windowEnd:   12,
			wantPaths:   []string{"a", "b", "c"},
			wantFirst:   0,
			wantCovered: true,
		},
		{
			name:        "skips segments before and after the window",
			entries:     []segmentEntry{seg("a", 0, 2), seg("b", 2, 10), seg("c", 10, 20)},
			windowStart: 3,
			windowEnd:   8,
			wantPaths:   []string{"b"},
			wantFirst:   2,
			wantCovered: true,
		},
		{
			name:        "gap between segments is rejected",
			entries:     []segmentEntry{seg("a", 0, 5), seg("b", 6, 10)},
			windowStart: 2,
			windowEnd:   9,
		},
		{
			name:        "window beginning not covered is rejected",
			entries:     []segmentEntry{seg("a", 5, 10)},
			windowStart: 0,
			windowEnd:   8,
		},
		{
			name:        "window extending past the last segment is rejected",
			entries:     []segmentEntry{seg("a", 0, 5)},
			windowStart: 2,
			windowEnd:   8,
		},
		{
			name:        "aged out segments are rejected",
			entries:     []segmentEntry{seg("a", 0, 5)},
			windowStart: 6,
			windowEnd:   8,
		},
		{
			name:        "small end gap within epsilon is accepted",
			entries:     []segmentEntry{seg("a", 0, 5)},
			windowStart: 2,
			windowEnd:   5.04,
			wantPaths:   []string{"a"},
			wantFirst:   0,
			wantCovered: true,
		},
		{
			name:        "small start gap within epsilon is accepted",
			entries:     []segmentEntry{seg("a", 0, 5), seg("b", 5.04, 10)},
			windowStart: 2,
			windowEnd:   9,
			wantPaths:   []string{"a", "b"},
			wantFirst:   0,
			wantCovered: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, first, ok := selectSegmentRange(tt.entries, tt.windowStart, tt.windowEnd)
			if ok != tt.wantCovered {
				t.Fatalf("covered = %v, want %v", ok, tt.wantCovered)
			}
			if !ok {
				if got != nil {
					t.Fatalf("entries = %v, want nil when not covered", got)
				}
				return
			}
			if first != tt.wantFirst {
				t.Errorf("firstStart = %v, want %v", first, tt.wantFirst)
			}
			if len(got) != len(tt.wantPaths) {
				t.Fatalf("paths = %v, want %v", got, tt.wantPaths)
			}
			for i, want := range tt.wantPaths {
				if got[i].path != want {
					t.Errorf("entry[%d] = %q, want %q", i, got[i].path, want)
				}
			}
		})
	}
}

func TestTailBufferRetainsNewestBytes(t *testing.T) {
	var b tailBuffer

	data := strings.Repeat("a", 100)
	if n, err := b.Write([]byte(data)); n != 100 || err != nil {
		t.Fatalf("Write = (%d, %v), want (100, nil)", n, err)
	}
	if got := b.String(); got != data {
		t.Fatalf("String = %q, want the full small buffer", got)
	}

	// Exceeding the limit in one write keeps only the newest bytes.
	large := strings.Repeat("x", processLogLimit+10)
	if _, err := b.Write([]byte(large)); err != nil {
		t.Fatalf("Write: %v", err)
	}
	got := b.String()
	if !strings.HasPrefix(got, "[ffmpeg output truncated]\n") {
		t.Fatalf("String missing truncation prefix: %q", got)
	}
	body := strings.TrimPrefix(got, "[ffmpeg output truncated]\n")
	if len(body) != processLogLimit || body != strings.Repeat("x", processLogLimit) {
		t.Fatalf("retained %d bytes, want %d newest bytes", len(body), processLogLimit)
	}
}

func TestTailBufferAccumulatesAcrossWrites(t *testing.T) {
	var b tailBuffer

	half := processLogLimit / 2
	if _, err := b.Write([]byte(strings.Repeat("a", half))); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if _, err := b.Write([]byte(strings.Repeat("b", half))); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if strings.HasPrefix(b.String(), "[ffmpeg output truncated]") {
		t.Fatal("filling to the limit exactly should not be marked truncated")
	}

	// A further write overflows by 5 bytes, dropping the oldest 5 a's.
	if _, err := b.Write([]byte("ccccc")); err != nil {
		t.Fatalf("Write: %v", err)
	}
	body := strings.TrimPrefix(b.String(), "[ffmpeg output truncated]\n")
	want := strings.Repeat("a", half-5) + strings.Repeat("b", half) + "ccccc"
	if body != want {
		t.Fatalf("retained tail mismatch: len=%d want=%d", len(body), len(want))
	}

	b.Reset()
	if got := b.String(); got != "" {
		t.Fatalf("after Reset String = %q, want empty", got)
	}
}

func TestTailBufferEmptyWrite(t *testing.T) {
	var b tailBuffer
	if n, err := b.Write(nil); n != 0 || err != nil {
		t.Fatalf("Write(nil) = (%d, %v), want (0, nil)", n, err)
	}
}

func TestFrameClockDue(t *testing.T) {
	start := time.Unix(1000, 0)

	if got := (*frameClock)(nil).due(start); got != 0 {
		t.Errorf("nil clock due = %d, want 0", got)
	}
	if got := newFrameClock(0, start).due(start); got != 0 {
		t.Errorf("zero-fps clock due = %d, want 0", got)
	}
	if got := newFrameClock(10, time.Time{}).due(start); got != 0 {
		t.Errorf("zero-start clock due = %d, want 0", got)
	}

	c := newFrameClock(10, start)
	if got := c.due(start.Add(-time.Second)); got != 1 {
		t.Errorf("before anchor due = %d, want 1", got)
	}
	if got := c.due(start); got != 1 {
		t.Errorf("at anchor due = %d, want 1", got)
	}

	c.frameEmitted()
	if got := c.due(start); got != 0 {
		t.Errorf("after emitting anchor frame due = %d, want 0", got)
	}
	if got := c.due(start.Add(100 * time.Millisecond)); got != 1 {
		t.Errorf("after 100ms due = %d, want 1", got)
	}
	c.frameEmitted()
	if got := c.due(start.Add(150 * time.Millisecond)); got != 0 {
		t.Errorf("mid-frame due = %d, want 0", got)
	}
	c.frameEmitted()
	if got := c.due(start.Add(250 * time.Millisecond)); got != 0 {
		t.Errorf("after 250ms due = %d, want 0", got)
	}
	if got := c.due(start.Add(390 * time.Millisecond)); got != 1 {
		t.Errorf("after 390ms due = %d, want 1", got)
	}

	if got := (*frameClock)(nil).stats(start).Emitted; got != 0 {
		t.Errorf("nil clock stats emitted = %d, want 0", got)
	}
}

func TestFrameClockStats(t *testing.T) {
	start := time.Unix(2000, 0)
	c := newFrameClock(10, start)
	for i := 0; i < 3; i++ {
		c.frameEmitted()
	}

	s := c.stats(start.Add(500 * time.Millisecond))
	if s.Emitted != 3 {
		t.Errorf("Emitted = %d, want 3", s.Emitted)
	}
	if s.Media != 200*time.Millisecond {
		t.Errorf("Media = %v, want 200ms", s.Media)
	}
	if s.Wall != 500*time.Millisecond {
		t.Errorf("Wall = %v, want 500ms", s.Wall)
	}
	if s.Skew != 300*time.Millisecond {
		t.Errorf("Skew = %v, want 300ms", s.Skew)
	}

	before := c.stats(start.Add(-time.Second))
	if before.Wall != 0 {
		t.Errorf("Wall before anchor = %v, want 0", before.Wall)
	}
	if before.Skew != -200*time.Millisecond {
		t.Errorf("Skew before anchor = %v, want -200ms", before.Skew)
	}
}

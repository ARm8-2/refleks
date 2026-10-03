package screen

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProbeReplayRejectsMissingFileAndUnreadableMetadata(t *testing.T) {
	dir := t.TempDir()
	e := &Encoder{ffmpegPath: filepath.Join(dir, "missing-ffmpeg")}
	// Mark probing complete so this test covers replay probing, not encoder discovery.
	e.probeOnce.Do(func() {})

	missing := filepath.Join(dir, "missing.mp4")
	if _, err := e.ProbeReplay(missing); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("ProbeReplay(missing file) error = %v, want os.ErrNotExist", err)
	}

	replay := filepath.Join(dir, "invalid.mp4")
	if err := os.WriteFile(replay, []byte("not a replay"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := e.ProbeReplay(replay); err == nil || !strings.Contains(err.Error(), "could not read replay metadata") {
		t.Fatalf("ProbeReplay(invalid file) error = %v, want metadata error", err)
	}
}

func TestParseProbeOutputUsesVideoMetadata(t *testing.T) {
	for _, tt := range []struct {
		name   string
		output string
		want   ReplayFileInfo
	}{
		{
			name: "h264 with fractional fps and duration",
			output: `Input #0, mov,mp4, from 'replay.mp4':
  Duration: 00:01:02.75, start: 0.000000, bitrate: 4000 kb/s
  Stream #0:0: Audio: aac, 48000 Hz, stereo
  Stream #0:1: Video: h264 (High), yuv420p, 1920x1080 [SAR 1:1 DAR 16:9], 3999 kb/s, 59.94 fps, 60 tbr`,
			want: ReplayFileInfo{Width: 1920, Height: 1080, FPS: 59.94, Codec: "h264", DurationSeconds: 62.75},
		},
		{
			name: "webm with long duration",
			output: `Duration: 01:02:03.5, start: 0.000000
  Stream #0:0: Video: vp9 (Profile 0), yuv420p, 1280x720, 30 fps, 30 tbr`,
			want: ReplayFileInfo{Width: 1280, Height: 720, FPS: 30, Codec: "vp9", DurationSeconds: 3723.5},
		},
		{
			name: "no duration still retains video info",
			output: `Duration: N/A
  Stream #0:0: Video: hevc (Main), yuv420p, 2560x1440, 60 fps, 60 tbr`,
			want: ReplayFileInfo{Width: 2560, Height: 1440, FPS: 60, Codec: "hevc"},
		},
		{name: "empty"},
		{name: "invalid file", output: "Invalid data found when processing input"},
		{name: "audio only", output: "Stream #0:0: Audio: aac, 48000 Hz, stereo"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseProbeOutput(tt.output); got != tt.want {
				t.Errorf("probe output = %+v, want %+v", got, tt.want)
			}
		})
	}
}

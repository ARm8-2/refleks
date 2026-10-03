package screen

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestTrimOffsetsRebasesSelectedSegments(t *testing.T) {
	const captureStart = int64(100000)
	for _, tt := range []struct {
		name               string
		first, start, end  int64
		wantStart, wantEnd float64
		wantErr            bool
	}{
		{"full session", 100000, 102500, 160000, 2.5, 60, false},
		{"rolling buffer starts later", 130000, 135250, 160750, 5.25, 30.75, false},
		{"negative start clamps to keyframe", 130000, 129000, 160000, 0, 30, false},
		{"segment before session", 99999, 102000, 160000, 0, 0, true},
		{"empty window", 100000, 110000, 110000, 0, 0, true},
		{"reversed window", 100000, 120000, 110000, 0, 0, true},
		{"end before selected segment", 130000, 120000, 125000, 0, 0, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			start, end, err := trimOffsets(captureStart, tt.first, tt.start, tt.end)
			if (err != nil) != tt.wantErr {
				t.Fatalf("trimOffsets error = %v, want error = %v", err, tt.wantErr)
			}
			if start != tt.wantStart || end != tt.wantEnd {
				t.Errorf("offsets = (%v, %v), want (%v, %v)", start, end, tt.wantStart, tt.wantEnd)
			}
		})
	}
}

func TestWriteConcatListPreservesOrderAndEscapesPaths(t *testing.T) {
	dir := t.TempDir()
	paths := []string{filepath.Join(dir, "second segment.mp4"), filepath.Join(dir, "first's segment.mp4")}
	list, err := writeConcatList(paths)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(list) })
	data, err := os.ReadFile(list)
	if err != nil {
		t.Fatal(err)
	}
	want := "ffconcat version 1.0\nfile '" + paths[0] + "'\nfile '" + filepath.Join(dir, "first'\\''s segment.mp4") + "'\n"
	if string(data) != want {
		t.Errorf("concat list = %q, want %q", data, want)
	}
}

func TestEncoderInfoAndUnavailableState(t *testing.T) {
	for _, tt := range []struct {
		name string
		hw   bool
	}{
		{"h264_nvenc", true}, {"h264_amf", true}, {"h264_qsv", true}, {"h264_vaapi", true}, {"libx264", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			e := &Encoder{ffmpegPath: "already-probed-ffmpeg", encoderName: tt.name, container: ".mp4"}
			// Model a completed probe without running hardware discovery.
			e.probeOnce.Do(func() {})
			if !e.Available() {
				t.Error("completed encoder probe should be available")
			}
			want := EncoderInfo{EncoderName: tt.name, Container: ".mp4", IsHardware: tt.hw}
			if got := e.Info(); got != want {
				t.Errorf("encoder info = %+v, want %+v", got, want)
			}
		})
	}
	e := &Encoder{}
	if e.Available() {
		t.Error("zero-value encoder unexpectedly available")
	}
	if err := e.TrimRecording(nil, "unused.mp4", 0, 0, 0, 1000); err == nil || !strings.Contains(err.Error(), "no ffmpeg encoder") {
		t.Errorf("TrimRecording error = %v, want unavailable encoder", err)
	}
	if _, err := e.ProbeReplay("unused.mp4"); err == nil || !strings.Contains(err.Error(), "ffmpeg not available") {
		t.Errorf("ProbeReplay error = %v, want unavailable ffmpeg", err)
	}
}

func TestTrimRecordingRejectsInvalidInputsBeforeRunningFFmpeg(t *testing.T) {
	e := &Encoder{ffmpegPath: "never-run-ffmpeg", encoderName: "libx264", container: ".mp4"}
	e.probeOnce.Do(func() {})
	dir := t.TempDir()
	segment := filepath.Join(dir, "segment.mp4")
	if err := os.WriteFile(segment, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		name        string
		paths       []string
		first, end  int64
		wantMessage string
	}{
		{"no inputs", nil, 1000, 2000, "no input recordings"},
		{"missing input", []string{filepath.Join(dir, "missing.mp4")}, 1000, 2000, "input recording not found"},
		{"invalid segment timestamp", []string{segment}, 999, 2000, "invalid first segment timestamp"},
		{"invalid window", []string{segment}, 1000, 1000, "invalid run window"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			out := filepath.Join(dir, "output.mp4")
			err := e.TrimRecording(tt.paths, out, 1000, tt.first, 1000, tt.end)
			if err == nil || !strings.Contains(err.Error(), tt.wantMessage) {
				t.Fatalf("TrimRecording error = %v, want %q", err, tt.wantMessage)
			}
			if tt.name == "missing input" && !errors.Is(err, os.ErrNotExist) {
				t.Errorf("missing input error lost os.ErrNotExist: %v", err)
			}
			if _, err := os.Stat(out); !os.IsNotExist(err) {
				t.Errorf("invalid trim produced output: %v", err)
			}
		})
	}
}

func TestTrimRecordingReturnsFFmpegExecutionError(t *testing.T) {
	dir := t.TempDir()
	segment := filepath.Join(dir, "segment.mp4")
	if err := os.WriteFile(segment, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	e := &Encoder{
		ffmpegPath:  filepath.Join(dir, "missing-ffmpeg"),
		encoderName: "libx264",
		container:   ".mp4",
	}
	// A fake completed probe lets the trim reach process execution without FFmpeg.
	e.probeOnce.Do(func() {})

	out := filepath.Join(dir, "output.mp4")
	err := e.TrimRecording([]string{segment}, out, 1000, 1000, 2000, 3000)
	if err == nil || !strings.Contains(err.Error(), "ffmpeg trim:") {
		t.Fatalf("TrimRecording error = %v, want FFmpeg execution error", err)
	}
	if _, err := os.Stat(out); !os.IsNotExist(err) {
		t.Errorf("failed trim produced an output file: %v", err)
	}
}

func TestEncoderArgsUseSharedCaptureAndProbeConfiguration(t *testing.T) {
	common := []string{"-pix_fmt", "yuv420p", "-profile:v", "high"}
	for _, tt := range []struct {
		name string
		want []string
	}{
		{"h264_nvenc", []string{"-preset", "p1", "-cq", "23", "-forced-idr", "1"}},
		{"h264_amf", []string{"-usage", "transcoding", "-quality", "balanced", "-rc", "cqp", "-qp_i", "23", "-qp_p", "23"}},
		{"h264_qsv", []string{"-preset", "fast", "-global_quality", "23"}},
		{"h264_vaapi", []string{"-qp", "23"}},
		{"libx264", []string{"-preset", "ultrafast", "-crf", "28"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			want := append([]string{"-c:v", tt.name}, common...)
			want = append(want, tt.want...)
			if got := encoderArgs(tt.name); !reflect.DeepEqual(got, want) {
				t.Errorf("encoderArgs = %v, want %v", got, want)
			}
		})
	}
}

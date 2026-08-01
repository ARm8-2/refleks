package screen

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// NewEncoder finds the ffmpeg binary but defers encoder probing to first use.
// ffmpeg -encoders is slow (launches a 138 MB subprocess) and must not block
// app startup — the probe runs lazily when Available/Info/TrimRecording is
// first called.
func NewEncoder() *Encoder {
	return &Encoder{ffmpegPath: findFFmpeg()}
}

// Available reports whether an ffmpeg binary was found and an encoder is available.
func (e *Encoder) Available() bool {
	e.ensureProbed()
	return e.ffmpegPath != "" && e.encoderName != ""
}

// Info returns encoder metadata for logging / UI display.
func (e *Encoder) Info() EncoderInfo {
	e.ensureProbed()
	isHW := strings.Contains(e.encoderName, "nvenc") ||
		strings.Contains(e.encoderName, "amf") ||
		strings.Contains(e.encoderName, "qsv") ||
		strings.Contains(e.encoderName, "vaapi")
	return EncoderInfo{
		EncoderName: e.encoderName,
		Container:   e.container,
		IsHardware:  isHW,
	}
}

// TrimRecording trims one or more contiguous, chronologically-ordered
// segment recordings down to the given time window using fast copy-safe
// seeking. When multiple segments are given, they are stitched together with
// ffmpeg's concat demuxer.
//
// The copied output starts at the beginning of the first selected segment,
// which is a keyframe boundary. Stream-copying from an arbitrary run timestamp
// can begin with a P/B frame and leave browser decoders black until the next
// keyframe. The concat demuxer presents the selected list at zero, so endSec
// remains the run end relative to that safe segment boundary.
//
// Must be called after Available() returns true.
func (e *Encoder) TrimRecording(inputPaths []string, outPath string, captureStartMs, firstSegmentStartMs, runStartMs, runEndMs int64) error {
	e.ensureProbed()
	if !e.Available() {
		return fmt.Errorf("no ffmpeg encoder available")
	}
	if len(inputPaths) == 0 {
		return fmt.Errorf("no input recordings provided")
	}
	for _, p := range inputPaths {
		if _, err := os.Stat(p); err != nil {
			return fmt.Errorf("input recording not found: %w", err)
		}
	}

	_, endSec, err := trimOffsets(captureStartMs, firstSegmentStartMs, runStartMs, runEndMs)
	if err != nil {
		return err
	}

	listPath, err := writeConcatList(inputPaths)
	if err != nil {
		return fmt.Errorf("build concat list: %w", err)
	}
	defer os.Remove(listPath)

	args := []string{
		"-f", "concat",
		"-safe", "0",
		"-i", listPath,
		"-map", "0:v:0",
		// Output starts at the selected segment's keyframe. Keeping the safe
		// prefix costs at most one short segment and avoids a non-decodable
		// stream-copy start in WebView2/Chromium.
		"-to", fmt.Sprintf("%.3f", endSec),
		"-c:v", "copy",
		"-avoid_negative_ts", "make_zero",
		"-an",
		"-y",
	}
	if strings.EqualFold(filepath.Ext(outPath), ".mp4") {
		// Move the moov atom to the front of the file. With -c copy this is
		// just a metadata rewrite (no re-encoding), but it lets the browser
		// start playback and seek after a single request instead of an extra
		// round trip to fetch metadata parked at the end of the file.
		args = append(args, "-movflags", "+faststart")
	}
	args = append(args, outPath)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, e.ffmpegPath, args...)
	cmd.Stdout = nil
	var stderr tailBuffer
	cmd.Stderr = &stderr
	hideCmdWindow(cmd)

	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("ffmpeg trim timed out: %w\nstderr: %s", ctx.Err(), stderr.String())
		}
		return fmt.Errorf("ffmpeg trim: %w\nstderr: %s", err, stderr.String())
	}
	return nil
}

// trimOffsets converts the wall-clock run window into the timeline exposed by
// ffconcat. A concat list starts at zero regardless of the source files'
// original session timestamps.
func trimOffsets(captureStartMs, firstSegmentStartMs, runStartMs, runEndMs int64) (float64, float64, error) {
	if firstSegmentStartMs < captureStartMs {
		return 0, 0, fmt.Errorf("invalid first segment timestamp")
	}
	startSec := float64(runStartMs-firstSegmentStartMs) / 1000.0
	if startSec < 0 {
		startSec = 0
	}
	endSec := float64(runEndMs-firstSegmentStartMs) / 1000.0
	if endSec <= startSec {
		return 0, 0, fmt.Errorf("invalid run window: end (%.3fs) <= start (%.3fs)", endSec, startSec)
	}
	return startSec, endSec, nil
}

// writeConcatList writes an ffconcat v1.0 script plainly listing paths in
// order. The copied replay starts at this list's first keyframe boundary; its
// end is limited by the output-side -to option in TrimRecording.
func writeConcatList(paths []string) (string, error) {
	f, err := os.CreateTemp("", "refleks-concat-*.txt")
	if err != nil {
		return "", err
	}
	defer f.Close()

	var b strings.Builder
	b.WriteString("ffconcat version 1.0\n")
	for _, p := range paths {
		abs, err := filepath.Abs(p)
		if err != nil {
			abs = p
		}
		// ffconcat quoting: wrap in single quotes, escaping embedded ones.
		escaped := strings.ReplaceAll(abs, "'", "'\\''")
		fmt.Fprintf(&b, "file '%s'\n", escaped)
	}
	if _, err := f.WriteString(b.String()); err != nil {
		return "", err
	}
	return f.Name(), nil
}

// ensureProbed runs the encoder probe once, lazily.
func (e *Encoder) ensureProbed() {
	e.probeOnce.Do(func() {
		if e.ffmpegPath != "" {
			e.probeEncoder()
		}
	})
}

func (e *Encoder) probeEncoder() {
	encoders := []struct {
		name      string
		container string
	}{
		// H.264 MP4 is the most broadly supported replay format in the
		// embedded Chromium player. Prefer its hardware encoders before newer
		// AV1/HEVC paths, which can produce files a Windows installation cannot
		// decode despite ffmpeg being able to encode them.
		{"h264_nvenc", ".mp4"},
		{"h264_amf", ".mp4"},
		{"h264_qsv", ".mp4"},
		{"h264_vaapi", ".mp4"},
		{"libx264", ".mp4"},
	}

	available := getAvailableEncoders(e.ffmpegPath)
	if available == nil {
		return
	}

	var diagnostics strings.Builder
	defer func() {
		e.probeDiagnostics = diagnostics.String()
	}()

	for _, enc := range encoders {
		if !available[enc.name] {
			continue
		}
		// ffmpeg -encoders only reports codecs this ffmpeg build was compiled
		// with; it says nothing about whether the current GPU/driver can open
		// the hardware path. Probe every candidate with the same encoder options
		// used by the real capture command, then fall through consistently.
		if ok, stderr := encoderWorks(e.ffmpegPath, enc.name); !ok {
			diagnostics.WriteString(enc.name)
			diagnostics.WriteString(": ")
			diagnostics.WriteString(stderr)
			diagnostics.WriteString("\n")
			continue
		}
		e.encoderName = enc.name
		e.container = enc.container
		return
	}
}

// encoderWorks asks ffmpeg to encode two synthetic BGRA frames using the
// same encoder-specific options as real capture. The raw BGRA input matters:
// it exercises the same pixel-format conversion path used by Desktop
// Duplication instead of only testing a lavfi source's native format.
//
// Returns stderr plus the process error on failure so callers can explain why
// a candidate was skipped.
func encoderWorks(ffmpegPath, name string) (ok bool, stderr string) {
	const (
		// Some AMD drivers reject tiny probe surfaces with AMF_OUT_OF_RANGE even
		// though normal replay resolutions are supported. Use a representative
		// browser/replay size instead of probing an artificial 64x64 stream.
		width      = 1280
		height     = 720
		frameBytes = width * height * 4
		frameCount = 2
	)

	args := []string{
		"-loglevel", "error",
		"-f", "rawvideo",
		"-pixel_format", "bgra",
		"-video_size", "1280x720",
		// Match the default capture rate; some hardware drivers reject unusual
		// probe-only frame rates even though normal 30/60 FPS capture works.
		"-framerate", "60",
		"-i", "-",
		"-frames:v", fmt.Sprintf("%d", frameCount),
	}
	args = append(args, encoderArgs(name)...)
	args = append(args, "-f", "null", "-")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, ffmpegPath, args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return false, fmt.Sprintf("create stdin pipe: %v", err)
	}
	var stderrBuf tailBuffer
	cmd.Stderr = &stderrBuf
	hideCmdWindow(cmd)
	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return false, fmt.Sprintf("start ffmpeg: %v", err)
	}

	frame := make([]byte, frameBytes)
	var writeErr error
	for i := 0; i < frameCount && writeErr == nil; i++ {
		buf := frame
		for len(buf) > 0 {
			n, err := stdin.Write(buf)
			if err != nil {
				writeErr = err
				break
			}
			if n == 0 {
				writeErr = fmt.Errorf("stdin write made no progress")
				break
			}
			buf = buf[n:]
		}
	}
	closeErr := stdin.Close()
	waitErr := cmd.Wait()
	if ctx.Err() != nil {
		return false, fmt.Sprintf("ffmpeg probe timed out: %v\nstderr: %s", ctx.Err(), stderrBuf.String())
	}
	if writeErr != nil {
		return false, fmt.Sprintf("write synthetic frames: %v\nstderr: %s", writeErr, stderrBuf.String())
	}
	if closeErr != nil {
		return false, fmt.Sprintf("close ffmpeg input: %v\nstderr: %s", closeErr, stderrBuf.String())
	}
	if waitErr != nil {
		return false, fmt.Sprintf("ffmpeg: %v\nstderr: %s", waitErr, stderrBuf.String())
	}
	return true, ""
}

// encoderArgs is the single source of truth for encoder settings. Both the
// runtime capture command and encoderWorks use it, so a candidate cannot pass
// a probe with one configuration and fail later with another.
func encoderArgs(name string) []string {
	args := []string{
		"-c:v", name,
		"-pix_fmt", "yuv420p",
		"-profile:v", "high",
	}
	switch {
	case strings.Contains(name, "nvenc"):
		args = append(args, "-preset", "p1", "-cq", "23", "-forced-idr", "1")
	case strings.Contains(name, "amf"):
		// Explicitly select a broadly supported usage and CQP mode. QP values
		// are only valid for CQP in AMF; relying on automatic rate-control
		// inference can make Init fail on some driver versions.
		args = append(args, "-usage", "transcoding", "-quality", "balanced", "-rc", "cqp", "-qp_i", "23", "-qp_p", "23")
	case strings.Contains(name, "qsv"):
		args = append(args, "-preset", "fast", "-global_quality", "23")
	case strings.Contains(name, "vaapi"):
		args = append(args, "-qp", "23")
	case strings.Contains(name, "libsvtav1"):
		args = append(args, "-preset", "8", "-crf", "35")
	default:
		args = append(args, "-preset", "ultrafast", "-crf", "28")
	}
	return args
}

// findFFmpeg searches for ffmpeg in priority order:
//  1. Bundled alongside the application executable (the build we ship and test).
//  2. On the system PATH (for development builds without a bundled copy).
//  3. In ~/.refleks/bin (legacy manual install location).
//
// Returns empty string if none is found.
func findFFmpeg() string {
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		for _, name := range []string{"ffmpeg", "ffmpeg.exe"} {
			c := filepath.Join(dir, name)
			if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
				return c
			}
		}
	}

	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p
	}

	if home, err := os.UserHomeDir(); err == nil {
		dir := filepath.Join(home, ".refleks", "bin")
		for _, name := range []string{"ffmpeg", "ffmpeg.exe"} {
			c := filepath.Join(dir, name)
			if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
				return c
			}
		}
	}

	return ""
}

func getAvailableEncoders(ffmpegPath string) map[string]bool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, ffmpegPath, "-encoders")
	var stdout strings.Builder
	cmd.Stdout = &stdout
	hideCmdWindow(cmd)
	if err := cmd.Run(); err != nil || ctx.Err() != nil {
		return nil
	}

	available := make(map[string]bool)
	for _, line := range strings.Split(stdout.String(), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Encoders:") || strings.HasPrefix(line, "---") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			available[fields[1]] = true
		}
	}
	return available
}

// ProbeDiagnostics returns diagnostics from failed encoder probes. Calling it
// also ensures the lazy probe has completed, making it safe to call directly.
func (e *Encoder) ProbeDiagnostics() string {
	e.ensureProbed()
	return e.probeDiagnostics
}

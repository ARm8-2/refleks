package screen

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"time"
)

// ReplayFileInfo describes technical metadata read directly from an
// already-encoded replay file (resolution, frame rate, codec, duration, file
// size). This is deliberately probed from the file itself rather than
// derived from the current screen capture settings, which may have changed
// since the replay was recorded.
type ReplayFileInfo struct {
	Width           int     `json:"width"`
	Height          int     `json:"height"`
	FPS             float64 `json:"fps"`
	Codec           string  `json:"codec"`
	DurationSeconds float64 `json:"durationSeconds"`
	SizeBytes       int64   `json:"sizeBytes"`
}

var (
	probeVideoStreamRe = regexp.MustCompile(`Video:\s*([a-zA-Z0-9_]+).*?(\d{2,5})x(\d{2,5})[^,]*,.*?([\d.]+)\s*fps`)
	probeDurationRe    = regexp.MustCompile(`Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)`)
)

// ProbeReplay reads technical metadata directly from a saved replay file
// using ffmpeg. There is no bundled ffprobe binary, but ffmpeg reports the
// same stream/format info on stderr even when invoked with no output file
// (it just exits non-zero after printing it), so a dedicated probe binary
// isn't needed.
func (e *Encoder) ProbeReplay(path string) (ReplayFileInfo, error) {
	e.ensureProbed()
	if e.ffmpegPath == "" {
		return ReplayFileInfo{}, fmt.Errorf("ffmpeg not available")
	}

	fi, err := os.Stat(path)
	if err != nil {
		return ReplayFileInfo{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, e.ffmpegPath, "-hide_banner", "-i", path)
	var stderr tailBuffer
	cmd.Stderr = &stderr
	hideCmdWindow(cmd)
	_ = cmd.Run() // ffmpeg exits non-zero without an output target by design.
	if ctx.Err() != nil {
		return ReplayFileInfo{}, fmt.Errorf("replay probe timed out: %w", ctx.Err())
	}

	info := parseProbeOutput(stderr.String())
	if info.Codec == "" || info.Width <= 0 || info.Height <= 0 {
		return ReplayFileInfo{}, fmt.Errorf("ffmpeg could not read replay metadata: %s", stderr.String())
	}
	info.SizeBytes = fi.Size()
	return info, nil
}

func parseProbeOutput(output string) ReplayFileInfo {
	var info ReplayFileInfo
	if m := probeVideoStreamRe.FindStringSubmatch(output); m != nil {
		info.Codec = m[1]
		info.Width, _ = strconv.Atoi(m[2])
		info.Height, _ = strconv.Atoi(m[3])
		info.FPS, _ = strconv.ParseFloat(m[4], 64)
	}
	if m := probeDurationRe.FindStringSubmatch(output); m != nil {
		hours, _ := strconv.ParseFloat(m[1], 64)
		mins, _ := strconv.ParseFloat(m[2], 64)
		secs, _ := strconv.ParseFloat(m[3], 64)
		info.DurationSeconds = hours*3600 + mins*60 + secs
	}
	return info
}

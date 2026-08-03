//go:build windows

package screen

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"refleks/internal/constants"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Windows DXGI Desktop Duplication screen capture.
//
// Frames are captured on a dedicated goroutine at the configured rate and
// handed off to a separate writer goroutine via a bounded channel. A small
// pre-allocated frame pool eliminates heap allocations; overload drops frames
// rather than retaining more raw desktop images in memory.
//
// D3D device resources are never freed while the capture goroutine is still
// active; a shutdown handshake (doneCh → writerDone) ensures pipeWriter
// finishes before rawStdin is closed.
//
// Rather than writing one continuous session-long file, ffmpeg's segment
// muxer is used to cut the recording into short, independently-finalized
// segment files (like OBS's replay buffer / GeForce Experience Instant
// Replay). This bounds disk usage to a rolling window regardless of how long
// a play session runs and lets a run's footage become available for
// trimming within seconds of the run ending, rather than only once the whole
// capture session stops.

type captureWin struct {
	ctx context.Context

	// lifecycleMu serializes complete Start/Stop transitions. The capture
	// goroutines refer to fields populated by Start, so allowing a new Start
	// while Stop is still draining the old session could cross-close completion
	// channels or release the wrong D3D resources.
	lifecycleMu sync.Mutex
	mu          sync.Mutex
	logMu       sync.Mutex
	segmentsMu  sync.Mutex // serializes selecting/leasing segments and retention pruning
	running     bool
	state       string
	lastError   string
	lastFrameAt time.Time
	ffmpegAlive bool

	failureHandler  func(error)
	failureNotified bool

	fps        int
	encName    string
	resolution string // e.g. "native", "1080", "900", "720"

	freeFrames chan []byte // buffers returned by the writer after ffmpeg has consumed them
	pipeChan   chan []byte

	// Desktop Duplication only signals changed desktop frames. Keep one latest
	// frame so the FFmpeg input still receives a constant-FPS stream when the
	// screen is static; otherwise video time would advance only on changes.
	latestMu    sync.RWMutex
	latestFrame []byte
	latestReady bool

	cmd      *exec.Cmd
	rawStdin io.WriteCloser
	segDir   string
	started  time.Time

	dev     uintptr
	d3dCtx  uintptr
	dup     uintptr
	staging uintptr
	width   uint32
	height  uint32
	stride  uint32

	doneCh      chan struct{} // closed by Stop, signals captureLoop/pruneLoop to exit
	captureDone chan struct{} // closed by captureLoop after it exits
	writerDone  chan struct{} // closed by pipeWriter when it finishes draining

	ffmpegExited  chan struct{} // closed once cmd.Wait() returns, whether expected or not
	ffmpegWaitErr error
	ffmpegStderr  tailBuffer

	// segmentLeases prevents retention pruning from deleting files while a trim
	// process has selected them but has not finished opening/reading them.
	// Protected by segmentsMu.
	segmentLeases   map[string]int
	lastCaptureWarn time.Time
}

var (
	winmm               = syscall.NewLazyDLL("winmm.dll")
	procTimeBeginPeriod = winmm.NewProc("timeBeginPeriod")
	procTimeEndPeriod   = winmm.NewProc("timeEndPeriod")
)

func New(ctx context.Context) Provider {
	return &captureWin{
		ctx:   ctx,
		fps:   constants.DefaultScreenCaptureFPS,
		state: CaptureStateIdle,
	}
}

// warnCapturef rate-limits recurring DXGI failures so a disconnected display
// or device reset cannot flood the application log at the capture frame rate.
func (c *captureWin) warnCapturef(format string, args ...any) {
	c.logMu.Lock()
	if time.Since(c.lastCaptureWarn) < 5*time.Second {
		c.logMu.Unlock()
		return
	}
	c.lastCaptureWarn = time.Now()
	c.logMu.Unlock()
	runtime.LogWarningf(c.ctx, format, args...)
}

func (c *captureWin) Configure(config CaptureConfig) {
	// The settings service validates user input before it reaches the
	// provider. Keep a defensive FPS fallback here as well because the
	// provider is also used by platform-specific runtime code.
	fps := config.FPS
	if fps < 1 || fps > 240 {
		fps = constants.DefaultScreenCaptureFPS
	}

	c.mu.Lock()
	c.fps = fps
	c.encName = config.Encoder
	c.resolution = config.Resolution
	if !c.running {
		c.state = CaptureStateIdle
		c.lastError = ""
		c.failureNotified = false
	}
	c.mu.Unlock()
}

func (c *captureWin) SetFailureHandler(handler func(error)) {
	c.mu.Lock()
	c.failureHandler = handler
	c.mu.Unlock()
}

func (c *captureWin) Status() ProviderStatus {
	c.mu.Lock()
	defer c.mu.Unlock()

	state := c.state
	message := c.lastError
	healthy := false
	if c.running {
		if c.ffmpegAlive && !c.lastFrameAt.IsZero() && time.Since(c.lastFrameAt) < 5*time.Second {
			state = CaptureStateCapturing
			message = "Capturing and receiving frames."
			healthy = true
		} else if state != CaptureStateError {
			state = CaptureStateStarting
			message = "Capture has not produced a frame yet."
		}
	} else if state == "" {
		state = CaptureStateIdle
	}
	lastFrameUnixMilli := int64(0)
	if !c.lastFrameAt.IsZero() {
		lastFrameUnixMilli = c.lastFrameAt.UnixMilli()
	}
	return ProviderStatus{
		Active:             c.running,
		Healthy:            healthy,
		State:              state,
		Message:            message,
		LastError:          c.lastError,
		LastFrameUnixMilli: lastFrameUnixMilli,
	}
}

// reportFailure records a runtime failure once per session and notifies the
// runtime outside the capture mutex so recovery can safely stop this session.
func (c *captureWin) reportFailure(err error) {
	if err == nil {
		return
	}
	var handler func(error)
	c.mu.Lock()
	if !c.running || c.failureNotified {
		c.mu.Unlock()
		return
	}
	c.state = CaptureStateError
	c.lastError = err.Error()
	c.failureNotified = true
	handler = c.failureHandler
	c.mu.Unlock()
	if handler != nil {
		go handler(err)
	}
}

func (c *captureWin) Start() error {
	c.lifecycleMu.Lock()
	defer c.lifecycleMu.Unlock()

	runtime.LogDebug(c.ctx, "screen: starting capture")
	c.mu.Lock()
	if c.running {
		c.mu.Unlock()
		runtime.LogDebug(c.ctx, "screen: capture already running")
		return nil
	}
	c.state = CaptureStateStarting
	c.lastError = ""
	c.lastFrameAt = time.Time{}
	c.ffmpegAlive = false
	c.failureNotified = false
	procTimeBeginPeriod.Call(1)
	// Keep the normal process-wide GC policy. Capture's hot path uses a fixed
	// frame pool, so increasing GOGC only lets unrelated UI/ingest allocations
	// accumulate for the entire capture session and inflates resident memory.

	// --- D3D11 device ---
	// Try without BGRA_SUPPORT first — the flag causes 0x80070057 (E_INVALIDARG)
	// on many Windows configs and isn't needed for desktop duplication.
	var dev, d3dCtx uintptr
	var featureLevel uint32
	featureLevels := []uint32{0xb100, 0xb000} // D3D_FEATURE_LEVEL_11_1, 11_0
	err := d3d11CreateDevice(0, d3dDriverTypeHardware, 0, 0,
		&featureLevels[0], uint32(len(featureLevels)), d3d11SdkVersion,
		&dev, &d3dCtx, &featureLevel)
	if err != nil {
		wrapped := fmt.Errorf("D3D11CreateDevice: %w", err)
		c.state = CaptureStateError
		c.lastError = wrapped.Error()
		procTimeEndPeriod.Call(1)
		c.mu.Unlock()
		return wrapped
	}
	runtime.LogDebugf(c.ctx, "screen: D3D11 device created (feature level 0x%x)", featureLevel)

	dup, width, height, err := createDupOutput(dev)
	if err != nil {
		wrapped := fmt.Errorf("create duplicate output: %w", err)
		releaseD3D(d3dCtx, dev)
		c.state = CaptureStateError
		c.lastError = wrapped.Error()
		procTimeEndPeriod.Call(1)
		c.mu.Unlock()
		return wrapped
	}
	runtime.LogDebugf(c.ctx, "screen: duplicate output created (%dx%d)", width, height)

	staging, err := createStagingTexture(dev, width, height)
	if err != nil {
		wrapped := fmt.Errorf("create staging texture: %w", err)
		releaseD3D(staging, dup, d3dCtx, dev)
		c.state = CaptureStateError
		c.lastError = wrapped.Error()
		procTimeEndPeriod.Call(1)
		c.mu.Unlock()
		return wrapped
	}

	frameBytes := int(width) * int(height) * 4
	// Two buffers bound the Go heap to roughly two native BGRA frames while
	// still allowing capture and ffmpeg I/O to overlap. Under backpressure we
	// drop a frame rather than retaining an unbounded queue.
	pool := make([][]byte, 2)
	for i := range pool {
		pool[i] = make([]byte, frameBytes)
	}
	latestFrame := make([]byte, frameBytes)

	encName := c.encName
	if encName == "" {
		encName = "libx264"
	}
	runtime.LogDebugf(c.ctx, "screen: encoder=%s fps=%d res=%q", encName, c.fps, c.resolution)

	// Startup removes abandoned sessions before capture begins. Keep the active
	// session untouched here until its pending replay trims finish.
	tempDir := os.TempDir()

	// ext
	ext := recordingExtension(encName)
	segDir := filepath.Join(tempDir, fmt.Sprintf("%s%d", constants.ScreenCaptureTempDirPrefix, time.Now().UnixMilli()))
	if err := os.MkdirAll(segDir, 0o755); err != nil {
		releaseD3D(staging, dup, d3dCtx, dev)
		procTimeEndPeriod.Call(1)
		c.mu.Unlock()
		return fmt.Errorf("create capture session dir: %w", err)
	}
	runtime.LogDebugf(c.ctx, "screen: session dir=%s", segDir)

	segSeconds := constants.ScreenCaptureSegmentSeconds
	keyframeSeconds := constants.ScreenCaptureKeyframeIntervalSeconds
	gopFrames := c.fps * keyframeSeconds
	if gopFrames < 1 {
		gopFrames = constants.DefaultScreenCaptureFPS * keyframeSeconds
	}
	// Keep ffmpeg's CSV index bounded to the same rolling window as the media
	// files. Otherwise every trim retry reparses an ever-growing session-long
	// file even though older segments have already been pruned.
	segmentListSize := constants.ScreenCaptureSegmentRetention/segSeconds + 2
	segPattern := filepath.Join(segDir, "seg-%06d"+ext)
	segList := filepath.Join(segDir, "segments.csv")

	args := []string{
		"-loglevel", "warning",
		"-nostats",
		"-f", "rawvideo",
		"-pixel_format", "bgra",
		"-video_size", fmt.Sprintf("%dx%d", width, height),
		"-framerate", fmt.Sprintf("%d", c.fps),
		"-i", "-",
		// Force frequent keyframes so segment cuts land near segment_time and
		// every selected segment can become a browser-decodable replay start.
		// Replay export retains the selected segment's safe keyframe lead-in
		// rather than copying from an arbitrary P/B frame.
		"-force_key_frames", fmt.Sprintf("expr:gte(t,n_forced*%d)", keyframeSeconds),
		// Bound GOP length as well as forcing wall-clock keyframes. This keeps
		// each browser seek to at most one second of decode work.
		"-g", strconv.Itoa(gopFrames),
	}
	// Keep encoder settings centralized with the runtime probe. The keyframe
	// and segmentation options above are capture-specific and are not needed
	// for the short probe encode.
	args = append(args, encoderArgs(encName)...)

	// Resolution scaling — downscale the captured frame to the user's
	// configured resolution while preserving aspect ratio. Uses the generic
	// scale filter rather than encoder-specific options (-resize, -s) because
	// those depend on the ffmpeg build's SDK version and aren't universally
	// available. The filter operates on raw BGRA frames before encoding, so
	// the performance cost is negligible.
	targetW, targetH := resolveResolution(width, height, c.resolution)
	if targetW != width || targetH != height {
		args = append(args, "-vf", fmt.Sprintf("scale=%d:%d", targetW, targetH))
	}

	args = append(args, "-an", "-y",
		"-f", "segment",
		"-segment_time", fmt.Sprintf("%d", segSeconds),
		"-reset_timestamps", "0",
		"-segment_format", strings.TrimPrefix(ext, "."),
	)
	if ext == ".mp4" {
		args = append(args, "-segment_format_options", "movflags=frag_keyframe+empty_moov")
	}
	args = append(args,
		"-segment_list", segList,
		"-segment_list_type", "csv",
		"-segment_list_size", fmt.Sprintf("%d", segmentListSize),
		"-segment_list_flags", "+live",
		segPattern,
	)

	ffmpegPath := findFFmpeg()
	runtime.LogDebugf(c.ctx, "screen: ffmpeg=%q args=%v", ffmpegPath, args)
	cmd := exec.Command(ffmpegPath, args...)
	cmd.Stdout = io.Discard
	c.ffmpegStderr.Reset()
	cmd.Stderr = &c.ffmpegStderr
	hideCmdWindow(cmd)

	rawStdin, err := cmd.StdinPipe()
	if err != nil {
		wrapped := fmt.Errorf("ffmpeg stdin pipe: %w", err)
		releaseD3D(staging, dup, d3dCtx, dev)
		_ = os.RemoveAll(segDir)
		c.state = CaptureStateError
		c.lastError = wrapped.Error()
		procTimeEndPeriod.Call(1)
		c.mu.Unlock()
		return wrapped
	}
	if err := cmd.Start(); err != nil {
		wrapped := fmt.Errorf("ffmpeg start: %w", err)
		_ = rawStdin.Close()
		releaseD3D(staging, dup, d3dCtx, dev)
		_ = os.RemoveAll(segDir)
		c.state = CaptureStateError
		c.lastError = wrapped.Error()
		procTimeEndPeriod.Call(1)
		c.mu.Unlock()
		return wrapped
	}

	c.dev = dev
	c.d3dCtx = d3dCtx
	c.dup = dup
	c.staging = staging
	c.width = width
	c.height = height
	c.stride = width * 4
	freeFrames := make(chan []byte, len(pool))
	for _, frame := range pool {
		freeFrames <- frame
	}
	pipeCh := make(chan []byte, 1)
	c.freeFrames = freeFrames
	c.pipeChan = pipeCh
	c.latestMu.Lock()
	c.latestFrame = latestFrame
	c.latestReady = false
	c.latestMu.Unlock()
	c.cmd = cmd
	c.rawStdin = rawStdin
	c.segDir = segDir
	c.started = time.Now()
	doneCh := make(chan struct{})
	captureDoneCh := make(chan struct{})
	writerDoneCh := make(chan struct{})
	ffmpegExitedCh := make(chan struct{})
	c.doneCh = doneCh
	c.captureDone = captureDoneCh
	c.writerDone = writerDoneCh
	c.ffmpegExited = ffmpegExitedCh
	c.ffmpegWaitErr = nil
	c.ffmpegAlive = true
	c.segmentsMu.Lock()
	c.segmentLeases = make(map[string]int)
	c.segmentsMu.Unlock()
	c.running = true
	c.mu.Unlock()

	// Reap ffmpeg's exit status immediately instead of only inside Stop().
	// cmd.Wait() may only be called once, so this goroutine is now the sole
	// owner of it; Stop() just waits on ffmpegExitedCh instead. If ffmpeg
	// dies on its own (bad args, encoder init failure, etc.) while we still
	// think we're running, this is our only chance to notice and log why.
	go func() {
		waitErr := cmd.Wait()
		var handler func(error)
		c.mu.Lock()
		c.ffmpegWaitErr = waitErr
		c.ffmpegAlive = false
		wasRunning := c.running
		stderr := c.ffmpegStderr.String()
		if wasRunning {
			err := fmt.Errorf("ffmpeg exited unexpectedly: %v; stderr: %s", waitErr, stderr)
			c.state = CaptureStateError
			c.lastError = err.Error()
			if !c.failureNotified {
				c.failureNotified = true
				handler = c.failureHandler
			}
		}
		c.mu.Unlock()
		close(ffmpegExitedCh)
		if wasRunning {
			runtime.LogErrorf(c.ctx, "screen: ffmpeg exited unexpectedly: %v; stderr: %s", waitErr, stderr)
			if handler != nil {
				go handler(fmt.Errorf("ffmpeg exited unexpectedly: %v; stderr: %s", waitErr, stderr))
			}
			// Do not leave desktop duplication and the capture/writer goroutines
			// running against a broken pipe for the rest of the game session.
			// Stop is lifecycle-serialized and will see the already-closed
			// ffmpegExited channel, so this is safe even if shutdown races it.
			go c.Stop()
		}
	}()

	go c.pipeWriter(pipeCh, freeFrames, rawStdin)
	go c.captureLoop()
	go c.pruneLoop(segDir, doneCh)
	return nil
}

func (c *captureWin) Stop() {
	c.lifecycleMu.Lock()
	defer c.lifecycleMu.Unlock()

	c.mu.Lock()
	if !c.running {
		c.mu.Unlock()
		return
	}
	c.running = false
	done := c.doneCh
	captureDone := c.captureDone
	pipeCh := c.pipeChan
	writerDone := c.writerDone
	rawStdin := c.rawStdin
	cmd := c.cmd
	segDir := c.segDir
	ffmpegExited := c.ffmpegExited
	c.mu.Unlock()

	// Stop the producer first. This handshake makes it impossible for the
	// capture loop to send into a channel while Stop is closing it. Closing
	// doneCh also stops the segment-pruning goroutine.
	close(done)
	if captureDone != nil {
		<-captureDone
	}

	if pipeCh != nil {
		close(pipeCh)
	}
	if writerDone != nil {
		// A blocked anonymous-pipe write can otherwise prevent shutdown forever.
		// Closing stdin and killing a wedged ffmpeg process unblocks the writer;
		// normal shutdown still drains naturally without dropping the final frame.
		select {
		case <-writerDone:
		case <-time.After(5 * time.Second):
			runtime.LogWarning(c.ctx, "screen: ffmpeg stdin did not drain; forcing capture shutdown")
			if rawStdin != nil {
				_ = rawStdin.Close()
			}
			if cmd != nil && cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			<-writerDone
		}
	}

	if rawStdin != nil {
		_ = rawStdin.Close()
	}

	// Wait for ffmpeg to consume EOF and finalize the last segment. Keeping
	// the segment files is intentional: the run store trims them after this
	// point, possibly well after Stop returns. cmd.Wait() itself is owned by
	// the goroutine spawned in Start(), since it may only be called once.
	if cmd != nil && cmd.Process != nil && ffmpegExited != nil {
		select {
		case <-ffmpegExited:
			c.mu.Lock()
			waitErr := c.ffmpegWaitErr
			stderr := c.ffmpegStderr.String()
			c.mu.Unlock()
			if waitErr != nil {
				runtime.LogWarningf(c.ctx, "screen: ffmpeg exited with error: %v; stderr: %s", waitErr, stderr)
			}
		case <-time.After(10 * time.Second):
			_ = cmd.Process.Kill()
			<-ffmpegExited
			c.mu.Lock()
			waitErr := c.ffmpegWaitErr
			stderr := c.ffmpegStderr.String()
			c.mu.Unlock()
			runtime.LogWarningf(c.ctx, "screen: ffmpeg timed out while finalizing: %v; stderr: %s", waitErr, stderr)
		}
	}

	c.mu.Lock()
	c.pipeChan = nil
	c.freeFrames = nil
	c.rawStdin = nil
	c.ffmpegAlive = false
	c.latestMu.Lock()
	c.latestFrame = nil
	c.latestReady = false
	c.latestMu.Unlock()
	if c.lastError == "" {
		c.state = CaptureStateIdle
	}
	c.mu.Unlock()

	// Release D3D resources (captureLoop has exited by now)
	c.mu.Lock()
	releaseD3D(c.staging, c.dup, c.d3dCtx, c.dev)
	c.staging = 0
	c.dup = 0
	c.d3dCtx = 0
	c.dev = 0
	c.mu.Unlock()

	if segDir != "" {
		c.pruneOldSegments(segDir)
	}

	procTimeEndPeriod.Call(1)
}

func (c *captureWin) Enabled() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.running
}

func (c *captureWin) Session() (string, time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.segDir, c.started
}

func (c *captureWin) Segments(dir string, sessionStart, start, end time.Time) ([]string, time.Duration, bool) {
	if dir == "" || !end.After(start) {
		return nil, 0, false
	}

	// Keep selection, existence checks, and leasing atomic with retention
	// pruning. Checking files first and leasing them afterward still leaves a
	// window in which pruning can remove a segment before ffmpeg opens it.
	c.segmentsMu.Lock()
	defer c.segmentsMu.Unlock()

	entries, err := readSegmentIndex(dir)
	if err != nil || len(entries) == 0 {
		return nil, 0, false
	}

	startRel := start.Sub(sessionStart).Seconds()
	if startRel < 0 {
		startRel = 0
	}
	endRel := end.Sub(sessionStart).Seconds()
	const epsilon = 0.05

	var paths []string
	var firstStart, previousEnd float64
	for _, e := range entries {
		if e.endSec <= startRel {
			continue
		}
		if e.startSec >= endRel {
			break
		}
		if len(paths) == 0 {
			// Do not silently clamp a run whose beginning has already fallen out
			// of the rolling buffer; that produces a plausible but wrong replay.
			if e.startSec > startRel+epsilon {
				return nil, 0, false
			}
			firstStart = e.startSec
		} else if e.startSec > previousEnd+epsilon {
			// CSV entries must cover one continuous media timeline. A gap means
			// the retention window or a failed segment has made this replay unsafe.
			return nil, 0, false
		}
		if _, err := os.Stat(e.path); err != nil {
			return nil, 0, false
		}
		paths = append(paths, e.path)
		previousEnd = e.endSec
	}
	if len(paths) == 0 || previousEnd < endRel-epsilon {
		return nil, 0, false
	}
	for _, path := range paths {
		c.segmentLeases[path]++
	}
	return paths, time.Duration(firstStart * float64(time.Second)), true
}

func (c *captureWin) ReleaseSegments(paths []string) {
	c.segmentsMu.Lock()
	defer c.segmentsMu.Unlock()
	for _, path := range paths {
		if c.segmentLeases[path] <= 1 {
			delete(c.segmentLeases, path)
			continue
		}
		c.segmentLeases[path]--
	}
}

func (c *captureWin) ReleaseSession(dir string) {
	if dir == "" {
		return
	}
	c.mu.Lock()
	if c.running && c.segDir == dir {
		c.mu.Unlock()
		return
	}
	if c.segDir == dir {
		c.segDir = ""
		c.started = time.Time{}
	}
	c.mu.Unlock()

	c.segmentsMu.Lock()
	defer c.segmentsMu.Unlock()
	_ = os.RemoveAll(dir)
}

// --- segment index (segments.csv) ---

type segmentEntry struct {
	path             string
	startSec, endSec float64
}

// readSegmentIndex parses the segment_list CSV ffmpeg maintains alongside a
// capture session's segment files. Rows are appended by ffmpeg only once a
// segment is fully closed, so this file also doubles as the "is this segment
// safe to read" signal.
func readSegmentIndex(dir string) ([]segmentEntry, error) {
	f, err := os.Open(filepath.Join(dir, "segments.csv"))
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	r.ReuseRecord = false

	var entries []segmentEntry
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			// Tolerate a partially-written trailing line (ffmpeg may be
			// mid-write); stop reading rather than failing the whole call.
			break
		}
		if len(rec) < 3 {
			continue
		}
		startSec, errS := strconv.ParseFloat(strings.TrimSpace(rec[1]), 64)
		endSec, errE := strconv.ParseFloat(strings.TrimSpace(rec[2]), 64)
		if errS != nil || errE != nil {
			continue
		}
		segPath := strings.TrimSpace(rec[0])
		if !filepath.IsAbs(segPath) {
			segPath = filepath.Join(dir, filepath.Base(segPath))
		}
		entries = append(entries, segmentEntry{path: segPath, startSec: startSec, endSec: endSec})
	}
	return entries, nil
}

// --- segment retention pruning ---

// pruneLoop periodically deletes closed segment files older than the
// retention window, bounding disk usage for long play sessions.
func (c *captureWin) pruneLoop(dir string, done <-chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			c.pruneOldSegments(dir)
		}
	}
}

// pruneOldSegments deletes closed segment files older than the retention
// window. The most-recently-modified file is never deleted, even if it is
// older than the retention window, as a safety margin against deleting the
// segment ffmpeg currently has open.
func (c *captureWin) pruneOldSegments(dir string) {
	c.segmentsMu.Lock()
	defer c.segmentsMu.Unlock()

	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	type fileInfo struct {
		path    string
		modTime time.Time
	}
	var files []fileInfo
	for _, e := range entries {
		if e.IsDir() || e.Name() == "segments.csv" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, fileInfo{path: filepath.Join(dir, e.Name()), modTime: info.ModTime()})
	}
	if len(files) <= 1 {
		return
	}

	sort.Slice(files, func(i, j int) bool { return files[i].modTime.Before(files[j].modTime) })
	files = files[:len(files)-1] // never delete the most recent (possibly still-open) segment

	cutoff := time.Now().Add(-time.Duration(constants.ScreenCaptureSegmentRetention) * time.Second)
	for _, f := range files {
		if f.modTime.Before(cutoff) && c.segmentLeases[f.path] == 0 {
			_ = os.Remove(f.path)
		}
	}
}

// --- capture loop ---

func (c *captureWin) captureLoop() {
	defer func() {
		c.mu.Lock()
		if c.captureDone != nil {
			close(c.captureDone)
		}
		c.mu.Unlock()
	}()

	c.mu.Lock()
	fps := c.fps
	c.mu.Unlock()
	if fps <= 0 {
		fps = constants.DefaultScreenCaptureFPS
	}
	interval := time.Second / time.Duration(fps)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-c.doneCh:
			return
		case <-ticker.C:
			c.captureFrame()
		}
	}
}

func (c *captureWin) repeatLatestFrame() {
	c.mu.Lock()
	freeFrames := c.freeFrames
	pipeCh := c.pipeChan
	done := c.doneCh
	running := c.running
	c.mu.Unlock()
	if !running || freeFrames == nil || pipeCh == nil {
		return
	}

	c.latestMu.RLock()
	if !c.latestReady || len(c.latestFrame) == 0 {
		c.latestMu.RUnlock()
		return
	}
	var frame []byte
	select {
	case frame = <-freeFrames:
	default:
		c.latestMu.RUnlock()
		return
	}
	copy(frame, c.latestFrame)
	c.latestMu.RUnlock()

	select {
	case <-done:
		freeFrames <- frame
	case pipeCh <- frame:
	default:
		freeFrames <- frame
	}
}

func (c *captureWin) captureFrame() {
	c.mu.Lock()
	dup := c.dup
	d3dCtx := c.d3dCtx
	staging := c.staging
	stride := c.stride
	width := c.width
	height := c.height
	freeFrames := c.freeFrames
	pipeCh := c.pipeChan
	done := c.doneCh
	c.mu.Unlock()

	if dup == 0 || freeFrames == nil || pipeCh == nil {
		return
	}

	// GPU work — fast, must not block on the mutex.
	dxgiResource, err := dxgiAcquireNextFrame(dup, 50)
	if err != nil {
		if err == errDxgiWaitTimeout {
			c.repeatLatestFrame()
			return
		}
		c.warnCapturef("screen: AcquireNextFrame: %v", err)
		c.reportFailure(err)
		return
	}

	// QueryInterface for ID3D11Texture2D — the resource from
	// AcquireNextFrame is an IDXGIResource, not usable directly with D3D11.
	iidTex2D := guidFromString("6f15aaf2-d208-4e89-9ab4-489535d34f9c")
	var d3dTex uintptr
	_ = comQueryInterface(dxgiResource, &iidTex2D, &d3dTex)
	iUnknownRelease(dxgiResource)
	if d3dTex == 0 {
		_ = dxgiReleaseFrame(dup)
		c.reportFailure(fmt.Errorf("QueryInterface(ID3D11Texture2D) returned null"))
		return
	}
	defer iUnknownRelease(d3dTex)
	defer dxgiReleaseFrame(dup)

	// Never write into a buffer until the writer has explicitly returned it.
	// The old ring index could wrap to a frame still being written to ffmpeg,
	// yielding intermittent corrupt video under backpressure.
	var currentBuf []byte
	select {
	case currentBuf = <-freeFrames:
	default:
		return
	}
	returned := false
	defer func() {
		if !returned {
			freeFrames <- currentBuf
		}
	}()

	d3d11CopyResource(d3dCtx, staging, d3dTex)

	// Lock before touching mapped surfaces; Stop() may have been called.
	c.mu.Lock()
	if !c.running || c.dup == 0 {
		c.mu.Unlock()
		return
	}

	mapped, err := d3d11Map(d3dCtx, staging, 0, 1)
	if err != nil {
		c.warnCapturef("screen: %v", err)
		c.mu.Unlock()
		c.reportFailure(err)
		return
	}

	// Memory copy — zero allocations.
	pixelSize := int(width) * int(height) * 4
	rowPitch := mapped.RowPitch
	if rowPitch == stride {
		copy(currentBuf, bytesFromPtr(mapped.pData, pixelSize))
	} else {
		srcBytes := bytesFromPtr(mapped.pData, int(height)*int(rowPitch))
		for y := uint32(0); y < height; y++ {
			srcOff := int(y * rowPitch)
			dstOff := int(y * stride)
			sLen := int(stride)
			copy(currentBuf[dstOff:dstOff+sLen], srcBytes[srcOff:srcOff+sLen])
		}
	}

	d3d11Unmap(d3dCtx, staging, 0)
	c.mu.Unlock()

	c.latestMu.Lock()
	copy(c.latestFrame, currentBuf)
	c.latestReady = true
	c.latestMu.Unlock()

	select {
	case <-done:
		return
	case pipeCh <- currentBuf:
		returned = true
	default:
		return
	}
}

// --- dedicated writer goroutine ---

func (c *captureWin) pipeWriter(pipeCh <-chan []byte, freeFrames chan<- []byte, rawStdin io.WriteCloser) {
	defer func() {
		c.mu.Lock()
		if c.writerDone != nil {
			close(c.writerDone)
		}
		c.mu.Unlock()
	}()

	// A bufio.Writer sized to a complete frame duplicates another full native
	// BGRA frame in memory (over 31 MiB at 4K). Pipes already buffer writes, so
	// write each frame directly while still handling short writes correctly.
	logged := false
	for frame := range pipeCh {
		buf := frame
		for len(buf) > 0 {
			n, err := rawStdin.Write(buf)
			if err != nil {
				if !logged {
					runtime.LogWarningf(c.ctx, "screen: ffmpeg stdin write failed (pipe likely broken): %v", err)
					logged = true
				}
				c.reportFailure(fmt.Errorf("ffmpeg stdin write failed: %w", err))
				return
			}
			if n == 0 {
				if !logged {
					runtime.LogWarning(c.ctx, "screen: ffmpeg stdin write made no progress")
					logged = true
				}
				c.reportFailure(fmt.Errorf("ffmpeg stdin write made no progress"))
				return
			}
			buf = buf[n:]
		}
		c.mu.Lock()
		if c.running {
			c.lastFrameAt = time.Now()
			c.state = CaptureStateCapturing
		}
		c.mu.Unlock()
		freeFrames <- frame
	}
}

// --- helpers ---

func releaseD3D(objs ...uintptr) {
	for _, o := range objs {
		if o != 0 {
			iUnknownRelease(o)
		}
	}
}

// --- D3D11 / DXGI interop ---

const (
	d3d11SdkVersion             = 7
	d3dDriverTypeHardware       = 1
	d3d11UsageStaging           = 3
	d3d11CPUAccessRead          = 0x20000
	dxgiFormatB8G8R8A8_UNorm    = 87
	dxgiErrorWaitTimeoutHresult = 0x887A0027
	dxgiErrorAccessLostHresult  = 0x887A0026
)

var (
	errDxgiWaitTimeout = fmt.Errorf("DXGI_ERROR_WAIT_TIMEOUT")
	errDxgiAccessLost  = fmt.Errorf("DXGI_ERROR_ACCESS_LOST")
)

type mappedSubresource struct {
	pData      uintptr
	RowPitch   uint32
	DepthPitch uint32
}

func d3d11CreateDevice(adapter, driverType, swModule, flags uintptr, featureLevels *uint32, numFeatureLevels, sdkVersion uint32, dev, ctx *uintptr, featureLevel *uint32) error {
	dll := syscall.NewLazyDLL("d3d11.dll")
	proc := dll.NewProc("D3D11CreateDevice")
	r, _, _ := proc.Call(adapter, driverType, swModule, flags,
		uintptr(unsafe.Pointer(featureLevels)), uintptr(numFeatureLevels), uintptr(sdkVersion),
		uintptr(unsafe.Pointer(dev)), uintptr(unsafe.Pointer(featureLevel)), uintptr(unsafe.Pointer(ctx)),
	)
	if r != 0 {
		return fmt.Errorf("D3D11CreateDevice failed: 0x%x", r)
	}
	return nil
}

func createDupOutput(dev uintptr) (dup uintptr, width, height uint32, err error) {
	var dxgiDev uintptr
	iidDxgiDev := guidFromString("54ec77fa-1377-44e6-8c32-88fd5f44c84c")
	hr := comQueryInterface(dev, &iidDxgiDev, &dxgiDev)
	if hr != 0 || dxgiDev == 0 {
		return 0, 0, 0, fmt.Errorf("QueryInterface(IDXGIDevice): 0x%x", hr)
	}
	defer iUnknownRelease(dxgiDev)

	iidAdapter := guidFromString("2411e7e1-12ac-4ccf-bd14-9798e8534dc0")
	var adapter uintptr
	hr = dxgiGetParent(dxgiDev, &iidAdapter, &adapter)
	if hr != 0 || adapter == 0 {
		return 0, 0, 0, fmt.Errorf("GetParent(IDXGIAdapter): 0x%x", hr)
	}
	defer iUnknownRelease(adapter)

	var output uintptr
	hr = dxgiEnumOutputs(adapter, 0, &output)
	if hr != 0 || output == 0 {
		return createDupViaFactory(dev)
	}
	defer iUnknownRelease(output)

	var desc dxgiOutputDesc
	_ = dxgiGetDesc(output, &desc)
	width = uint32(desc.DesktopCoordinates.Right - desc.DesktopCoordinates.Left)
	height = uint32(desc.DesktopCoordinates.Bottom - desc.DesktopCoordinates.Top)
	if width == 0 {
		width = 1920
	}
	if height == 0 {
		height = 1080
	}

	iidOutput1 := guidFromString("00cddea8-939b-4b83-a340-a685226666cc")
	var output1 uintptr
	hr = comQueryInterface(output, &iidOutput1, &output1)
	if hr != 0 || output1 == 0 {
		return 0, 0, 0, fmt.Errorf("QueryInterface(IDXGIOutput1): 0x%x", hr)
	}
	defer iUnknownRelease(output1)
	hr = dxgiDuplicateOutput(output1, dev, &dup)
	if hr != 0 {
		return 0, 0, 0, fmt.Errorf("DuplicateOutput: 0x%x", hr)
	}
	return dup, width, height, nil
}

func createDupViaFactory(dev uintptr) (dup uintptr, width, height uint32, err error) {
	dll := syscall.NewLazyDLL("dxgi.dll")
	proc := dll.NewProc("CreateDXGIFactory1")
	iidFactory := guidFromString("770aae78-f26f-4dba-a829-253c83d1b387")
	var factory uintptr
	r, _, _ := proc.Call(uintptr(unsafe.Pointer(&iidFactory)), uintptr(unsafe.Pointer(&factory)))
	if r != 0 || factory == 0 {
		return 0, 0, 0, fmt.Errorf("CreateDXGIFactory1: 0x%x", r)
	}
	defer iUnknownRelease(factory)

	var adapter uintptr
	hr := dxgiEnumAdapters(factory, 0, &adapter)
	if hr != 0 || adapter == 0 {
		return 0, 0, 0, fmt.Errorf("EnumAdapters: 0x%x", hr)
	}
	defer iUnknownRelease(adapter)

	var output uintptr
	hr = dxgiEnumOutputs(adapter, 0, &output)
	if hr != 0 || output == 0 {
		return 0, 0, 0, fmt.Errorf("EnumOutputs: 0x%x", hr)
	}
	defer iUnknownRelease(output)

	var desc dxgiOutputDesc
	_ = dxgiGetDesc(output, &desc)
	if desc.DesktopCoordinates.Right > 0 {
		width = uint32(desc.DesktopCoordinates.Right - desc.DesktopCoordinates.Left)
		height = uint32(desc.DesktopCoordinates.Bottom - desc.DesktopCoordinates.Top)
	} else {
		width = 1920
		height = 1080
	}

	iidOutput1 := guidFromString("00cddea8-939b-4b83-a340-a685226666cc")
	var output1 uintptr
	hr = comQueryInterface(output, &iidOutput1, &output1)
	if hr != 0 || output1 == 0 {
		return 0, 0, 0, fmt.Errorf("QueryInterface(IDXGIOutput1): 0x%x", hr)
	}
	defer iUnknownRelease(output1)
	hr = dxgiDuplicateOutput(output1, dev, &dup)
	if hr != 0 {
		return 0, 0, 0, fmt.Errorf("DuplicateOutput: 0x%x", hr)
	}
	return dup, width, height, nil
}

func createStagingTexture(dev uintptr, width, height uint32) (uintptr, error) {
	desc := d3d11Texture2DDesc{
		Width: width, Height: height, MipLevels: 1, ArraySize: 1,
		Format: dxgiFormatB8G8R8A8_UNorm, SampleCount: 1, SampleQuality: 0,
		Usage: d3d11UsageStaging, BindFlags: 0, CPUAccessFlags: d3d11CPUAccessRead, MiscFlags: 0,
	}
	var tex uintptr
	hr := d3d11CreateTexture2D(dev, &desc, nil, &tex)
	if hr != 0 {
		return 0, fmt.Errorf("CreateTexture2D(staging): 0x%x", hr)
	}
	return tex, nil
}

// --- COM helpers ---

type guid struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

func guidFromString(s string) guid {
	var g guid
	s = trimBrace(s)
	fmt.Sscanf(s, "%08x-%04x-%04x-%02x%02x-%02x%02x%02x%02x%02x%02x",
		&g.Data1, &g.Data2, &g.Data3,
		&g.Data4[0], &g.Data4[1], &g.Data4[2], &g.Data4[3],
		&g.Data4[4], &g.Data4[5], &g.Data4[6], &g.Data4[7])
	return g
}
func trimBrace(s string) string {
	if len(s) >= 2 && s[0] == '{' && s[len(s)-1] == '}' {
		return s[1 : len(s)-1]
	}
	return s
}
func iUnknownRelease(obj uintptr) uint32 { return comVtblCall3(obj, 2) }
func comQueryInterface(obj uintptr, iid *guid, out *uintptr) uint32 {
	return comVtblCall3(obj, 0, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(out)))
}
func comVtblCall3(obj uintptr, methodIdx int, args ...uintptr) uint32 {
	vtbl := ptrToUintptr(obj)
	method := ptrToUintptr(vtbl + uintptr(methodIdx)*unsafe.Sizeof(uintptr(0)))
	allArgs := []uintptr{obj}
	allArgs = append(allArgs, args...)
	r, _, _ := syscall.SyscallN(method, allArgs...)
	return uint32(r)
}
func bytesFromPtr(p uintptr, n int) []byte { return unsafe.Slice((*byte)(unsafe.Pointer(p)), n) }
func ptrToUintptr(p uintptr) uintptr       { return *(*uintptr)(unsafe.Pointer(p)) }

func dxgiGetParent(obj uintptr, iid *guid, out *uintptr) uint32 {
	return comVtblCall3(obj, 6, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(out)))
}
func dxgiEnumOutputs(adapter uintptr, idx uint32, output *uintptr) uint32 {
	return comVtblCall3(adapter, 7, uintptr(idx), uintptr(unsafe.Pointer(output)))
}
func dxgiEnumAdapters(factory uintptr, idx uint32, adapter *uintptr) uint32 {
	return comVtblCall3(factory, 7, uintptr(idx), uintptr(unsafe.Pointer(adapter)))
}

type dxgiOutputDesc struct {
	DeviceName         [32]uint16
	DesktopCoordinates struct{ Left, Top, Right, Bottom int32 }
	AttachedToDesktop  int32
	Rotation           uint32
	Monitor            uintptr
}

func dxgiGetDesc(output uintptr, desc *dxgiOutputDesc) uint32 {
	return comVtblCall3(output, 7, uintptr(unsafe.Pointer(desc)))
}
func dxgiDuplicateOutput(output1 uintptr, dev uintptr, dup *uintptr) uint32 {
	return comVtblCall3(output1, 22, dev, uintptr(unsafe.Pointer(dup)))
}

// dxgiOutduplFrameInfo mirrors DXGI_OUTDUPL_FRAME_INFO exactly (48 bytes on
// x64). Using an undersized buffer here causes AcquireNextFrame to write past
// the end of it, corrupting adjacent memory (including the resource pointer
// below) and leading to hard-to-diagnose crashes on later COM calls.
type dxgiOutduplFrameInfo struct {
	LastPresentTime           int64
	LastMouseUpdateTime       int64
	AccumulatedFrames         uint32
	RectsCoalesced            int32
	ProtectedContentMaskedOut int32
	PointerPosition           struct {
		X, Y    int32
		Visible int32
	}
	TotalMetadataBufferSize uint32
	PointerShapeBufferSize  uint32
}

func dxgiAcquireNextFrame(dup uintptr, timeoutMs uint32) (resource uintptr, err error) {
	var frameInfo dxgiOutduplFrameInfo
	r := comVtblCall3(dup, 8, uintptr(timeoutMs),
		uintptr(unsafe.Pointer(&frameInfo)),
		uintptr(unsafe.Pointer(&resource)),
	)
	if r != 0 {
		if r == uint32(dxgiErrorWaitTimeoutHresult) {
			return 0, errDxgiWaitTimeout
		}
		if r == uint32(dxgiErrorAccessLostHresult) {
			return 0, errDxgiAccessLost
		}
		return 0, fmt.Errorf("AcquireNextFrame: 0x%x", r)
	}
	if resource < 0x10000 {
		return 0, fmt.Errorf("AcquireNextFrame returned null or invalid resource")
	}
	return resource, nil
}
func dxgiReleaseFrame(dup uintptr) uint32 { return comVtblCall3(dup, 14) }

type d3d11Texture2DDesc struct {
	Width, Height, MipLevels, ArraySize, Format, SampleCount, SampleQuality, Usage, BindFlags, CPUAccessFlags, MiscFlags uint32
}

func d3d11CreateTexture2D(dev uintptr, desc *d3d11Texture2DDesc, initialData unsafe.Pointer, tex *uintptr) uint32 {
	return comVtblCall3(dev, 5, uintptr(unsafe.Pointer(desc)), uintptr(initialData), uintptr(unsafe.Pointer(tex)))
}
func d3d11CopyResource(ctx uintptr, dst, src uintptr) { comVtblCall3(ctx, 47, dst, src) }
func d3d11Map(ctx uintptr, resource uintptr, subresource uint32, mapType uint32) (mappedSubresource, error) {
	var mapped mappedSubresource
	r := comVtblCall3(ctx, 14, resource, uintptr(subresource), uintptr(mapType), 0, uintptr(unsafe.Pointer(&mapped)))
	if r != 0 {
		return mapped, fmt.Errorf("Map: 0x%x", r)
	}
	return mapped, nil
}
func d3d11Unmap(ctx uintptr, resource uintptr, subresource uint32) {
	comVtblCall3(ctx, 15, resource, uintptr(subresource))
}

// resolveResolution returns the target encode dimensions, clamped to native.
func recordingExtension(string) string { return ".mp4" }

// resolveResolution returns an even, aspect-preserving output size that never
// upscales. yuv420p requires even dimensions; keeping the source aspect ratio
// avoids distorted output on displays that do not match a preset exactly.
func resolveResolution(nativeW, nativeH uint32, res string) (uint32, uint32) {
	maxW, maxH := nativeW, nativeH
	switch res {
	case "720":
		maxW, maxH = 1280, 720
	case "900":
		maxW, maxH = 1600, 900
	case "1080":
		maxW, maxH = 1920, 1080
	}
	w, h := nativeW, nativeH
	if nativeW > maxW || nativeH > maxH {
		if uint64(nativeW)*uint64(maxH) > uint64(nativeH)*uint64(maxW) {
			w = maxW
			h = uint32(uint64(nativeH) * uint64(maxW) / uint64(nativeW))
		} else {
			h = maxH
			w = uint32(uint64(nativeW) * uint64(maxH) / uint64(nativeH))
		}
	}
	if w > 1 && w%2 != 0 {
		w--
	}
	if h > 1 && h%2 != 0 {
		h--
	}
	return w, h
}

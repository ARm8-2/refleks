package runs

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/runs/screen"
)

const replayLifecycleWait = 5 * time.Second

type replayLifecycleSegmentRequest struct {
	dir          string
	sessionStart time.Time
	start        time.Time
	end          time.Time
}

type replayLifecycleSegmentResult struct {
	paths []string
	first time.Duration
	ready bool
}

type replayLifecycleProvider struct {
	mu               sync.Mutex
	dir              string
	started          time.Time
	enabled          bool
	sessionCalls     int
	requests         []replayLifecycleSegmentRequest
	results          []replayLifecycleSegmentResult
	releasedSegments [][]string
	releasedSessions []string
	releaseOrder     []string
	beforeSegments   func()
}

var _ screen.Provider = (*replayLifecycleProvider)(nil)

func (*replayLifecycleProvider) Configure(screen.CaptureConfig) {}
func (*replayLifecycleProvider) SetFailureHandler(func(error))  {}
func (*replayLifecycleProvider) Status() screen.ProviderStatus {
	return screen.ProviderStatus{}
}
func (p *replayLifecycleProvider) Start() error {
	p.mu.Lock()
	p.enabled = true
	p.mu.Unlock()
	return nil
}
func (p *replayLifecycleProvider) Stop() {
	p.mu.Lock()
	p.enabled = false
	p.mu.Unlock()
}
func (p *replayLifecycleProvider) Enabled() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.enabled
}
func (p *replayLifecycleProvider) Session() (string, time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sessionCalls++
	return p.dir, p.started
}
func (p *replayLifecycleProvider) Segments(dir string, sessionStart, start, end time.Time) ([]string, time.Duration, bool) {
	p.mu.Lock()
	i := len(p.requests)
	p.requests = append(p.requests, replayLifecycleSegmentRequest{dir, sessionStart, start, end})
	var result replayLifecycleSegmentResult
	if i < len(p.results) {
		result = p.results[i]
	}
	p.mu.Unlock()
	if p.beforeSegments != nil {
		p.beforeSegments()
	}
	return result.paths, result.first, result.ready
}
func (p *replayLifecycleProvider) ReleaseSegments(paths []string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.releasedSegments = append(p.releasedSegments, append([]string(nil), paths...))
	p.releaseOrder = append(p.releaseOrder, "segments")
}
func (p *replayLifecycleProvider) ReleaseSession(dir string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.releasedSessions = append(p.releasedSessions, dir)
	p.releaseOrder = append(p.releaseOrder, "session:"+dir)
}
func (p *replayLifecycleProvider) rotate(dir string, started time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.dir, p.started, p.enabled = dir, started, true
}

func awaitReplayLifecycle(t *testing.T, done <-chan struct{}) {
	t.Helper()
	timer := time.NewTimer(replayLifecycleWait)
	defer timer.Stop()
	select {
	case <-done:
	case <-timer.C:
		t.Fatal("replay lifecycle operation did not complete within its bound")
	}
}

func replayLifecycleTrim(t *testing.T) pendingScreenTrim {
	t.Helper()
	start := time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)
	return pendingScreenTrim{
		runPath:      filepath.Join(t.TempDir(), "run"+constants.RunFileExt),
		runFileName:  "run",
		dir:          "old-session",
		sessionStart: start,
		runStart:     start.Add(time.Minute),
		runEnd:       start.Add(2 * time.Minute),
		replayEnd:    start.Add(2*time.Minute + time.Duration(constants.ScreenCaptureReplayTailSeconds)*time.Second),
	}
}

func assertReplayLifecycleStatus(t *testing.T, s *Store, runPath, state, message string) {
	t.Helper()
	if got := s.GetReplayStatus(runPath); got.State != state || got.Message != message {
		t.Fatalf("replay status = %+v, want state %q, message %q", got, state, message)
	}
}

func TestReplayLifecycleCaptureSessionForRun(t *testing.T) {
	base := time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)
	middle, newest := base.Add(time.Hour), base.Add(2*time.Hour)
	tests := []struct {
		name          string
		start, end    time.Time
		wantDir       string
		wantStart     time.Time
		nilProvider   bool
		noCurrentDir  bool
		noCurrentTime bool
		invalid       bool
	}{
		{name: "late run uses newest eligible retained session", start: middle.Add(time.Minute), end: middle.Add(2 * time.Minute), wantDir: "middle", wantStart: middle},
		{name: "older late run skips newer retained sessions", start: base.Add(time.Minute), end: base.Add(2 * time.Minute), wantDir: "old", wantStart: base},
		{name: "run may start exactly at retained session boundary", start: middle, end: middle.Add(time.Minute), wantDir: "middle", wantStart: middle},
		{name: "crossing rotation still selects session containing run start", start: middle.Add(time.Minute), end: newest.Add(time.Minute), wantDir: "middle", wantStart: middle},
		{name: "current session is registered and selected", start: newest, end: newest.Add(time.Minute), wantDir: "new", wantStart: newest},
		{name: "historical run is not clamped to a newer session", start: base.Add(-time.Minute), end: base},
		{name: "retained session works without a current directory", start: middle, end: middle.Add(time.Minute), wantDir: "middle", wantStart: middle, noCurrentDir: true},
		{name: "current session with unknown start is ignored", start: newest, end: newest.Add(time.Minute), wantDir: "middle", wantStart: middle, noCurrentTime: true},
		{name: "missing provider cannot use retained sessions", start: middle, end: middle.Add(time.Minute), nilProvider: true, invalid: true},
		{name: "zero start", end: middle, invalid: true},
		{name: "zero end", start: middle, invalid: true},
		{name: "empty window", start: middle, end: middle, invalid: true},
		{name: "reversed window", start: middle, end: base, invalid: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newIsolatedStore(t)
			s.screenSessions["old"], s.screenSessions["middle"] = base, middle
			p := &replayLifecycleProvider{dir: "new", started: newest, enabled: true}
			if tt.noCurrentDir {
				p.dir = ""
			}
			if tt.noCurrentTime {
				p.started = time.Time{}
			}
			var provider screen.Provider = p
			if tt.nilProvider {
				provider = nil
			}
			dir, started := s.captureSessionForRun(provider, tt.start, tt.end)
			if dir != tt.wantDir || !started.Equal(tt.wantStart) {
				t.Fatalf("selected (%q, %v), want (%q, %v)", dir, started, tt.wantDir, tt.wantStart)
			}
			wantSessions := map[string]time.Time{"old": base, "middle": middle}
			if !tt.invalid && !tt.noCurrentDir && !tt.noCurrentTime {
				wantSessions["new"] = newest
			}
			if !reflect.DeepEqual(s.screenSessions, wantSessions) {
				t.Fatalf("retained sessions = %v, want %v", s.screenSessions, wantSessions)
			}
			if tt.invalid && p.sessionCalls != 0 {
				t.Fatal("invalid request consulted the provider")
			}
		})
	}
}

func TestReplayLifecycleFinalizeIgnoresUnavailableSession(t *testing.T) {
	for _, name := range []string{"missing provider", "active session", "empty stopped session"} {
		t.Run(name, func(t *testing.T) {
			s := newIsolatedStore(t)
			p := &replayLifecycleProvider{dir: "session", started: time.Now()}
			switch name {
			case "active session":
				p.enabled = true
				s.SetScreenCapture(nil, p, nil)
			case "empty stopped session":
				p.dir = ""
				s.SetScreenCapture(nil, p, nil)
			}
			s.FinalizeScreenCapture()
			if len(s.screenFinalizing) != 0 || len(s.screenReleasePending) != 0 || len(s.screenSessions) != 0 || len(p.releasedSessions) != 0 {
				t.Fatal("finalization changed bookkeeping or released an unavailable session")
			}
		})
	}
}

func TestReplayLifecycleFinalizationBookkeeping(t *testing.T) {
	s := newIsolatedStore(t)
	trim := replayLifecycleTrim(t)
	p := &replayLifecycleProvider{dir: trim.dir, started: trim.sessionStart}
	s.SetScreenCapture(nil, p, nil)
	s.screenTrimCounts[trim.dir] = 2

	// Pending trims suppress the real 30-second grace goroutine entirely.
	s.FinalizeScreenCapture()
	s.FinalizeScreenCapture()
	if !s.screenFinalizing[trim.dir] || s.screenReleasePending[trim.dir] || !s.screenSessions[trim.dir].Equal(trim.sessionStart) {
		t.Fatal("stopped session was not retained for its pending trims")
	}
	s.screenReleasePending[trim.dir] = true
	s.releaseFinalizedScreenSession(trim.dir)
	if s.screenTrimCounts[trim.dir] != 2 || !s.screenFinalizing[trim.dir] || s.screenReleasePending[trim.dir] || len(p.releasedSessions) != 0 {
		t.Fatal("grace callback must defer release while trims are pending and clear its timer marker")
	}
	s.finishScreenTrim(trim.dir)
	if s.screenTrimCounts[trim.dir] != 1 || !s.screenFinalizing[trim.dir] || len(p.releasedSessions) != 0 {
		t.Fatal("first of two trims prematurely released its session")
	}

	newStart := trim.sessionStart.Add(time.Hour)
	p.rotate("new-session", newStart)
	s.screenSessions["new-session"] = newStart
	s.finishScreenTrim(trim.dir)
	s.releaseFinalizedScreenSession(trim.dir) // A stale grace callback must be harmless.
	if !reflect.DeepEqual(p.releasedSessions, []string{trim.dir}) {
		t.Fatalf("released sessions = %v, want only the stopped session", p.releasedSessions)
	}
	if len(s.screenTrimCounts) != 0 || len(s.screenFinalizing) != 0 || len(s.screenReleasePending) != 0 {
		t.Fatal("last trim left finalization bookkeeping behind")
	}
	if !reflect.DeepEqual(s.screenSessions, map[string]time.Time{"new-session": newStart}) {
		t.Fatalf("finalization removed the new session or retained the old one: %v", s.screenSessions)
	}
}

func TestReplayLifecycleGraceReleaseUsesCapturedDirectory(t *testing.T) {
	s := newIsolatedStore(t)
	trim := replayLifecycleTrim(t)
	newStart := trim.sessionStart.Add(time.Hour)
	p := &replayLifecycleProvider{dir: "new-session", started: newStart, enabled: true}
	s.SetScreenCapture(nil, p, nil)
	s.screenSessions[trim.dir], s.screenSessions[p.dir] = trim.sessionStart, newStart
	s.screenFinalizing[trim.dir], s.screenReleasePending[trim.dir] = true, true

	// Exercise the grace callback directly, without starting an unjoinable timer.
	s.releaseFinalizedScreenSession(trim.dir)
	s.releaseFinalizedScreenSession(trim.dir)
	if !reflect.DeepEqual(p.releasedSessions, []string{trim.dir}) {
		t.Fatalf("grace callback released %v, want the old directory exactly once", p.releasedSessions)
	}
	if len(s.screenFinalizing) != 0 || len(s.screenReleasePending) != 0 || len(s.screenTrimCounts) != 0 || !reflect.DeepEqual(s.screenSessions, map[string]time.Time{p.dir: newStart}) {
		t.Fatal("grace release did not clean only the finalized session")
	}
}

type replayLifecycleObservedContext struct {
	context.Context
	observed chan struct{}
	once     sync.Once
}

func (c *replayLifecycleObservedContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.observed) })
	return c.Context.Done()
}

func TestReplayLifecyclePendingTrimBlocksReleaseAndShutdown(t *testing.T) {
	s := newIsolatedStore(t)
	trim := replayLifecycleTrim(t)
	entered, proceed, trimmed := make(chan struct{}), make(chan struct{}), make(chan struct{})
	ctx, cancel := context.WithTimeout(context.Background(), replayLifecycleWait)
	defer cancel()
	var enteredOnce sync.Once
	p := &replayLifecycleProvider{
		dir: trim.dir, started: trim.sessionStart,
		results: []replayLifecycleSegmentResult{{paths: []string{"leased-segment.mp4"}, ready: true}},
		beforeSegments: func() {
			enteredOnce.Do(func() { close(entered) })
			select {
			case <-proceed:
			case <-ctx.Done():
			}
		},
	}
	// With no capture encoder, status updates remain testable without a Wails context.
	s.SetScreenCapture(nil, p, nil)
	s.screenTrimCounts[trim.dir] = 1
	s.beginReplayTrim(trim.runPath)
	go func() {
		defer close(trimmed)
		defer s.finishScreenTrim(trim.dir)
		defer s.finishReplayTrim(trim.runPath)
		s.runScreenTrim(trim)
	}()
	t.Cleanup(func() {
		cancel()
		awaitReplayLifecycle(t, trimmed)
	})
	awaitReplayLifecycle(t, entered)
	s.FinalizeScreenCapture()
	p.rotate("new-session", trim.sessionStart.Add(time.Hour))
	s.releaseFinalizedScreenSession(trim.dir)
	p.mu.Lock()
	releases := len(p.releasedSessions)
	p.mu.Unlock()
	if releases != 0 {
		t.Fatal("session released while segment acquisition was still blocked")
	}

	waitCtx := &replayLifecycleObservedContext{Context: ctx, observed: make(chan struct{})}
	waitDone := make(chan struct{})
	var waited bool
	go func() {
		defer close(waitDone)
		waited = s.WaitForScreenTrims(waitCtx)
	}()
	t.Cleanup(func() {
		cancel()
		awaitReplayLifecycle(t, waitDone)
	})
	awaitReplayLifecycle(t, waitCtx.observed)
	select {
	case <-waitDone:
		t.Fatal("shutdown wait completed with a trim still pending")
	default:
	}
	close(proceed)
	awaitReplayLifecycle(t, trimmed)
	awaitReplayLifecycle(t, waitDone)
	if !waited {
		t.Fatal("shutdown wait did not observe the completed trim")
	}
	assertReplayLifecycleStatus(t, s, trim.runPath, models.ReplayStateFailed, constants.ReplayProcessingFailed)
	if !reflect.DeepEqual(p.releaseOrder, []string{"segments", "session:" + trim.dir}) {
		t.Fatalf("release order = %v, want segment leases returned before the old session", p.releaseOrder)
	}
	if len(s.activeReplayTrims) != 0 || len(s.screenTrimCounts) != 0 || len(s.screenFinalizing) != 0 || len(s.screenSessions) != 0 {
		t.Fatal("completed worker left lifecycle bookkeeping behind")
	}
}

func TestReplayLifecycleWaitForScreenTrimsCountsAllSessions(t *testing.T) {
	s := newIsolatedStore(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s.screenTrimCounts["old"], s.screenTrimCounts["new"] = 2, 1
	for _, dir := range []string{"old", "old", "new"} {
		if s.WaitForScreenTrims(ctx) {
			t.Fatal("shutdown wait ignored an active trim")
		}
		s.finishScreenTrim(dir)
	}
	if !s.WaitForScreenTrims(ctx) {
		t.Fatal("no pending trims should succeed even when the context is canceled")
	}
}

func TestReplayLifecycleRunScreenTrimTerminalPaths(t *testing.T) {
	tests := []struct {
		name        string
		missing     bool
		enabled     bool
		replaced    bool
		deleted     bool
		results     []replayLifecycleSegmentResult
		wantMessage string
		wantCalls   int
		wantLeases  [][]string
	}{
		{name: "missing provider", missing: true, wantMessage: constants.ReplayCaptureStopped},
		{name: "ready tail returns leases on encoder error", enabled: true, results: []replayLifecycleSegmentResult{{paths: []string{"one.mp4", "two.mp4"}, first: time.Minute, ready: true}}, wantMessage: constants.ReplayProcessingFailed, wantCalls: 1, wantLeases: [][]string{{"one.mp4", "two.mp4"}}},
		{name: "ready tail returns leases on deletion rejection", enabled: true, deleted: true, results: []replayLifecycleSegmentResult{{paths: []string{"deleted.mp4"}, ready: true}}, wantMessage: constants.ReplayProcessingFailed, wantCalls: 1, wantLeases: [][]string{{"deleted.mp4"}}},
		{name: "stopped session falls back to scenario end", results: []replayLifecycleSegmentResult{{}, {paths: []string{"fallback.mp4"}, first: time.Minute, ready: true}}, wantMessage: constants.ReplayProcessingFailed, wantCalls: 2, wantLeases: [][]string{{"fallback.mp4"}}},
		{name: "fallback returns leases on deletion rejection", deleted: true, results: []replayLifecycleSegmentResult{{}, {paths: []string{"deleted-fallback.mp4"}, ready: true}}, wantMessage: constants.ReplayProcessingFailed, wantCalls: 2, wantLeases: [][]string{{"deleted-fallback.mp4"}}},
		{name: "replaced session falls back despite active capture", enabled: true, replaced: true, results: []replayLifecycleSegmentResult{{}, {paths: []string{"old.mp4"}, ready: true}}, wantMessage: constants.ReplayProcessingFailed, wantCalls: 2, wantLeases: [][]string{{"old.mp4"}}},
		{name: "stopped session without scenario segments fails immediately", results: []replayLifecycleSegmentResult{{}, {}}, wantMessage: constants.ReplaySegmentsMissing, wantCalls: 2},
		{name: "replaced session without scenario segments fails immediately", enabled: true, replaced: true, results: []replayLifecycleSegmentResult{{}, {}}, wantMessage: constants.ReplaySegmentsMissing, wantCalls: 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newIsolatedStore(t)
			trim := replayLifecycleTrim(t)
			p := &replayLifecycleProvider{dir: trim.dir, started: trim.sessionStart, enabled: tt.enabled, results: tt.results}
			if tt.replaced {
				p.dir, p.started = "new-session", trim.sessionStart.Add(time.Hour)
			}
			if !tt.missing {
				s.SetScreenCapture(nil, p, nil)
			}
			wantActive := 0
			if tt.deleted {
				s.SetScreenCapture(nil, p, &screen.Encoder{})
				s.beginReplayTrim(trim.runPath)
				defer s.finishReplayTrim(trim.runPath)
				wantActive = 1
				if err := s.DeleteReplay(trim.runPath); err != nil {
					t.Fatal(err)
				}
			}
			s.setReplayStatus(trim.runPath, models.ReplayStateProcessing, constants.ReplayProcessing)
			done := make(chan struct{})
			go func() {
				defer close(done)
				s.runScreenTrim(trim)
			}()
			awaitReplayLifecycle(t, done)
			assertReplayLifecycleStatus(t, s, trim.runPath, models.ReplayStateFailed, tt.wantMessage)
			wantRequests := []replayLifecycleSegmentRequest(nil)
			if tt.wantCalls > 0 {
				wantRequests = append(wantRequests, replayLifecycleSegmentRequest{trim.dir, trim.sessionStart, trim.runStart, trim.replayEnd})
			}
			if tt.wantCalls > 1 {
				wantRequests = append(wantRequests, replayLifecycleSegmentRequest{trim.dir, trim.sessionStart, trim.runStart, trim.runEnd})
			}
			if !reflect.DeepEqual(p.requests, wantRequests) {
				t.Fatalf("segment requests = %+v, want %+v", p.requests, wantRequests)
			}
			if !reflect.DeepEqual(p.releasedSegments, tt.wantLeases) {
				t.Fatalf("returned leases = %v, want exactly %v", p.releasedSegments, tt.wantLeases)
			}
			_, tombstone := s.deletedReplays[trim.runPath]
			if len(p.releasedSessions) != 0 || s.activeReplayTrims[trim.runPath] != wantActive || tombstone != tt.deleted || len(s.screenTrimCounts) != 0 {
				t.Fatal("trim execution must leave session/worker/deletion bookkeeping to its caller")
			}
		})
	}
}

func TestReplayLifecyclePublishStatusWithoutWailsContext(t *testing.T) {
	s := newIsolatedStore(t)
	trim := replayLifecycleTrim(t)
	s.publishReplayStatus(trim.runPath, models.ReplayStateFailed, constants.ReplayProcessingFailed)
	assertReplayLifecycleStatus(t, s, trim.runPath, models.ReplayStateFailed, constants.ReplayProcessingFailed)
	s.publishReplayStatus(trim.runPath, models.ReplayStateReady, constants.ReplayReady)
	if len(s.replayStatuses) != 0 || s.GetReplayStatus(trim.runPath).State != models.ReplayStateUnavailable {
		t.Fatal("ready publication must clear the status marker, not invent a replay file")
	}
}

func TestReplayLifecycleDeletionRejectsLateTrimPreflight(t *testing.T) {
	s := newIsolatedStore(t)
	trim := replayLifecycleTrim(t)
	// This isolates deletion preflight with a zero-value encoder. Post-encode
	// publication is covered in replay_publication_test.go.
	s.SetScreenCapture(nil, nil, &screen.Encoder{})
	for _, ext := range []string{".mp4", ".webm"} {
		path, err := s.ReplayPath(trim.runPath, ext)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("previous replay"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	dir, err := s.ReplaysDir()
	if err != nil {
		t.Fatal(err)
	}
	keep := filepath.Join(dir, "unrelated.mp4")
	if err := os.WriteFile(keep, []byte("keep"), 0o600); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), replayLifecycleWait)
	defer cancel()
	type worker struct {
		entered chan struct{}
		proceed chan struct{}
		done    chan struct{}
		err     error
	}
	workers := []*worker{
		{entered: make(chan struct{}), proceed: make(chan struct{}), done: make(chan struct{})},
		{entered: make(chan struct{}), proceed: make(chan struct{}), done: make(chan struct{})},
	}
	for _, w := range workers {
		s.beginReplayTrim(trim.runPath)
		go func() {
			defer close(w.done)
			defer s.finishReplayTrim(trim.runPath)
			close(w.entered)
			select {
			case <-w.proceed:
				w.err = s.trimScreenRecording(trim, []string{"leased-segment.mp4"}, 0)
			case <-ctx.Done():
				w.err = ctx.Err()
			}
		}()
		t.Cleanup(func() {
			cancel()
			awaitReplayLifecycle(t, w.done)
		})
		awaitReplayLifecycle(t, w.entered)
	}
	if err := s.DeleteReplay(trim.runPath); err != nil {
		t.Fatal(err)
	}
	for i, w := range workers {
		close(w.proceed)
		awaitReplayLifecycle(t, w.done)
		if w.err == nil || !strings.Contains(w.err.Error(), "deleted while processing") {
			t.Fatalf("late trim %d returned %v, want deletion rejection", i, w.err)
		}
		s.replayMu.Lock()
		_, tombstone := s.deletedReplays[trim.runPath]
		active := s.activeReplayTrims[trim.runPath]
		s.replayMu.Unlock()
		wantActive := len(workers) - i - 1
		if active != wantActive || tombstone != (wantActive > 0) {
			t.Fatalf("after trim %d: active=%d tombstone=%v, want active=%d tombstone=%v", i, active, tombstone, wantActive, wantActive > 0)
		}
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name() != filepath.Base(keep) {
		t.Fatalf("deleted replay was resurrected or left artifacts: %v", entries)
	}
	if len(s.activeReplayTrims) != 0 || len(s.deletedReplays) != 0 {
		t.Fatal("finished exports retained deletion bookkeeping")
	}
}

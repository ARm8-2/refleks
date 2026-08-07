package runs

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/runs/kovaaks"
	"refleks/internal/runs/screen"
	appsettings "refleks/internal/settings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Store manages the .refleks run directory.
type Store struct {
	settingsSvc    *appsettings.Service
	ctx            context.Context
	screenProvider screen.Provider
	encoder        *screen.Encoder

	screenMu             sync.Mutex
	screenTrimCounts     map[string]int  // in-flight trims keyed by capture session directory
	screenFinalizing     map[string]bool // sessions awaiting release once their trims finish
	screenReleasePending map[string]bool // grace timer scheduled for a stopped session
	screenSessions       map[string]time.Time

	// replayMu serializes replay publication/deletion. A deletion tombstone is
	// retained only while a trim for that run is active, preventing resurrection
	// without retaining one map entry forever for every deleted replay.
	replayMu          sync.Mutex
	activeReplayTrims map[string]int
	deletedReplays    map[string]struct{}
	replayStatuses    map[string]models.ReplayStatus

	// index caches the runs directory listing and parsed run summaries so
	// repeated history queries avoid re-reading and re-decompressing files.
	index *runIndex

	// replaySet is the cached replays directory scan. Publishes and deletions
	// both rename files, which bumps the directory modification time, so the
	// cache is validated with a stat instead of explicit invalidation.
	replaySetMu  sync.Mutex
	replaySetDir string
	replaySetMod time.Time
	replaySet    map[string]struct{}

	// cleanupMu coalesces startup, settings, and replay-publication cleanup
	// triggers so only one cleanup pass touches the replay directory at a time.
	cleanupMu      sync.Mutex
	cleanupRunning bool
	cleanupPending bool
}

// NewStore constructs a run store.
func NewStore(settingsSvc *appsettings.Service) *Store {
	return &Store{
		settingsSvc:          settingsSvc,
		screenTrimCounts:     make(map[string]int),
		screenFinalizing:     map[string]bool{},
		screenReleasePending: make(map[string]bool),
		screenSessions:       make(map[string]time.Time),
		activeReplayTrims:    make(map[string]int),
		deletedReplays:       make(map[string]struct{}),
		replayStatuses:       make(map[string]models.ReplayStatus),
		index:                newRunIndex(),
	}
}

// setReplayStatus updates the in-memory status exposed to the history UI.
func (s *Store) setReplayStatus(runPath, state, message string) {
	s.replayMu.Lock()
	if state == models.ReplayStateReady {
		delete(s.replayStatuses, runPath)
	} else {
		s.replayStatuses[runPath] = models.ReplayStatus{
			State:   state,
			Message: message,
		}
	}
	s.replayMu.Unlock()
}

// publishReplayStatus updates the in-memory status and pushes it to the UI so
// the replay tab resolves the moment a trim reaches a terminal state instead
// of waiting for its next poll tick. The processing state is never pushed: it
// is set at ingest time, usually before the tab mounts, and only terminal
// transitions are worth an event.
func (s *Store) publishReplayStatus(runPath, state, message string) {
	s.setReplayStatus(runPath, state, message)
	if s.ctx == nil {
		return
	}
	runtime.EventsEmit(s.ctx, constants.EventReplayStatus, map[string]any{
		"path":    runPath,
		"state":   state,
		"message": message,
	})
}

// GetReplayStatus returns the current processing state for a run. A published
// file always wins over an in-memory status so a completed export cannot be
// hidden by a stale processing marker.
func (s *Store) GetReplayStatus(runPath string) models.ReplayStatus {
	for _, ext := range []string{".mp4", ".webm"} {
		if path, err := s.ReplayPath(runPath, ext); err == nil {
			if _, err := os.Stat(path); err == nil {
				return models.ReplayStatus{State: models.ReplayStateReady, Message: "Replay is ready."}
			}
		}
	}

	s.replayMu.Lock()
	status, ok := s.replayStatuses[runPath]
	s.replayMu.Unlock()
	if ok {
		return status
	}
	return models.ReplayStatus{
		State:   models.ReplayStateUnavailable,
		Message: "No replay was recorded for this run.",
	}
}

// SetScreenCapture configures the screen capture provider and encoder used
// during run ingestion to generate screen recordings.
func (s *Store) SetScreenCapture(ctx context.Context, prov screen.Provider, enc *screen.Encoder) {
	s.screenMu.Lock()
	defer s.screenMu.Unlock()
	s.ctx = ctx
	s.screenProvider = prov
	s.encoder = enc
}

// captureSessionForRun chooses the newest retained capture session that began
// before the run. This lets a late stats event still use the session that
// actually contains the run, even if a newer session has already started.
func (s *Store) captureSessionForRun(provider screen.Provider, runStart, runEnd time.Time) (string, time.Time) {
	if provider == nil || runStart.IsZero() || !runEnd.After(runStart) {
		return "", time.Time{}
	}
	currentDir, currentStart := provider.Session()

	s.screenMu.Lock()
	if currentDir != "" && !currentStart.IsZero() {
		s.screenSessions[currentDir] = currentStart
	}
	bestDir := ""
	bestStart := time.Time{}
	for dir, sessionStart := range s.screenSessions {
		if sessionStart.After(runStart) || !runEnd.After(sessionStart) {
			continue
		}
		if bestStart.IsZero() || sessionStart.After(bestStart) {
			bestDir = dir
			bestStart = sessionStart
		}
	}
	s.screenMu.Unlock()
	return bestDir, bestStart
}

// WaitForScreenTrims waits for active replay exports to finish. It is used
// during normal shutdown so cleanup cannot delete segment files underneath an
// FFmpeg trim that is about to publish a replay.
func (s *Store) WaitForScreenTrims(ctx context.Context) bool {
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	for {
		s.screenMu.Lock()
		pending := 0
		for _, count := range s.screenTrimCounts {
			pending += count
		}
		s.screenMu.Unlock()
		if pending == 0 {
			return true
		}
		select {
		case <-ctx.Done():
			return false
		case <-ticker.C:
		}
	}
}

func (s *Store) runsDir() (string, error) {
	base, err := appsettings.GetConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, constants.RunsSubdirName)

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// ReplaysDir returns the screen recording replay directory, creating it if needed.
func (s *Store) ReplaysDir() (string, error) {
	base, err := appsettings.GetConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, constants.ReplaysSubdirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// ReplayPath returns the full path to a replay file derived from a run's file path.
// The replay filename uses the same base name as the run record with the given extension.
func (s *Store) ReplayPath(runFilePath string, ext string) (string, error) {
	dir, err := s.ReplaysDir()
	if err != nil {
		return "", err
	}
	base := strings.TrimSuffix(filepath.Base(runFilePath), constants.RunFileExt)
	return filepath.Join(dir, base+ext), nil
}

// DeleteReplay removes all supported replay containers for a run. It is
// coordinated with publication so a trim that completes at the same time
// cannot make a user-deleted replay reappear.
func (s *Store) DeleteReplay(runFilePath string) error {
	s.replayMu.Lock()
	defer s.replayMu.Unlock()

	if s.activeReplayTrims[runFilePath] > 0 {
		s.deletedReplays[runFilePath] = struct{}{}
	}
	var firstErr error
	for _, ext := range []string{".mp4", ".webm"} {
		path, err := s.ReplayPath(runFilePath, ext)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (s *Store) beginReplayTrim(runPath string) {
	s.replayMu.Lock()
	s.activeReplayTrims[runPath]++
	s.replayMu.Unlock()
}

func (s *Store) finishReplayTrim(runPath string) {
	s.replayMu.Lock()
	defer s.replayMu.Unlock()
	if s.activeReplayTrims[runPath] <= 1 {
		delete(s.activeReplayTrims, runPath)
		delete(s.deletedReplays, runPath)
		return
	}
	s.activeReplayTrims[runPath]--
}

// replayFileSet returns the set of replay base names (without extension) that
// have replay files. The replays directory is rescanned only when its
// modification time changes; replay publishes and deletions both rename files
// in the directory, so the cache stays honest without explicit invalidation.
// Callers must not mutate the returned set.
func (s *Store) replayFileSet() map[string]struct{} {
	dir, err := s.ReplaysDir()
	if err != nil {
		return nil
	}

	s.replaySetMu.Lock()
	defer s.replaySetMu.Unlock()
	if s.replaySet != nil && s.replaySetDir == dir {
		if fi, err := os.Stat(dir); err == nil && fi.ModTime().Equal(s.replaySetMod) {
			return s.replaySet
		}
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	set := make(map[string]struct{}, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		ext := filepath.Ext(name)
		if ext == ".mp4" || ext == ".webm" {
			set[strings.TrimSuffix(name, ext)] = struct{}{}
		}
	}

	s.replaySetDir = dir
	s.replaySet = set
	if fi, err := os.Stat(dir); err == nil {
		s.replaySetMod = fi.ModTime()
	}
	return set
}

// Exists reports whether the given stats file already has a stored run record.
// The run index answers from memory once the directory has been scanned, so
// the watcher's per-file ingestion checks avoid disk stats.
func (s *Store) Exists(statsFileName string) bool {
	dir, err := s.runsDir()
	if err != nil {
		return false
	}
	if err := s.index.ensureScanned(dir); err != nil {
		return false
	}
	for _, runName := range candidateRunFileNames(statsFileName) {
		if s.index.contains(runName) {
			return true
		}
	}
	return false
}

// Save persists a run record to disk and returns its final file path.
func (s *Store) Save(rec storedRunRecord) (string, error) {
	if strings.TrimSpace(rec.FileName) == "" {
		return "", errors.New("missing file name")
	}

	dir, err := s.runsDir()
	if err != nil {
		return "", err
	}

	outPath := filepath.Join(dir, filepath.Base(rec.FileName)+constants.RunFileExt)
	// A unique temporary file keeps overlapping watcher/scan ingestion from
	// corrupting each other's record before the atomic publish rename.
	f, err := os.CreateTemp(dir, "."+filepath.Base(outPath)+"-*.tmp")
	if err != nil {
		return "", err
	}
	tmpPath := f.Name()

	writeErr := writeRecord(f, rec)
	closeErr := f.Close()
	if writeErr != nil {
		_ = os.Remove(tmpPath)
		return "", writeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return "", closeErr
	}

	if err := os.Rename(tmpPath, outPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", err
	}

	s.index.add(dir, filepath.Base(outPath), rec.EpochMilli)

	return outPath, nil
}

// LoadRunStatsEvents reads a single .refleks file by full path and returns the
// CSV-derived event rows nested under stats.events.
func (s *Store) LoadRunStatsEvents(filePath string) ([]models.RunStatsEvent, error) {
	rec, err := readRecordFile(filePath, readRecordOptions{skipPerformanceEvents: true, skipMouseTrace: true})
	if err != nil {
		return nil, err
	}
	statsEvents := rec.Stats.Events
	if statsEvents == nil {
		return []models.RunStatsEvent{}, nil
	}
	return statsEvents, nil
}

// LoadRunPerformanceEvents reads a single .refleks file by full path and
// returns the performance event list stored in the v2 performances payload.
func (s *Store) LoadRunPerformanceEvents(filePath string) ([]models.RunPerformanceEvent, error) {
	rec, err := readRecordFile(filePath, readRecordOptions{skipStatsEvents: true, skipMouseTrace: true})
	if err != nil {
		return nil, err
	}
	if rec.Performances == nil || rec.Performances.Events == nil {
		return []models.RunPerformanceEvent{}, nil
	}
	return rec.Performances.Events, nil
}

// LoadRunTrace reads a single .refleks file by full path and returns its mouse
// trace encoded in the frontend wire format.
func (s *Store) LoadRunTrace(filePath string) (string, error) {
	rec, err := readRecordFile(filePath, readRecordOptions{skipStatsEvents: true, skipPerformanceEvents: true})
	if err != nil {
		return "", err
	}
	if rec.MouseTrace == nil {
		return "", nil
	}
	if len(rec.MouseTrace) == 0 {
		return "", nil
	}

	return EncodeTraceBase64(rec.MouseTrace)
}

// LoadRecentRuns returns recent runs in oldest-to-newest order.
// Stats events, performance event lists, and trace data are omitted to keep the
// bulk recent-runs payload informative but lightweight.
func (s *Store) LoadRecentRuns(limit int) ([]models.RunRecord, error) {
	selected, err := s.selectRecentFiles(limit)
	if err != nil {
		return nil, err
	}

	replays := s.replayFileSet()

	out := make([]models.RunRecord, 0, len(selected))
	for _, v := range selected {
		rec, ok := s.index.cachedRecord(v.path)
		if !ok {
			rec, err = readRecordFile(v.path, readRecordOptions{skipStatsEvents: true, skipPerformanceEvents: true, skipMouseTrace: true})
			if err != nil {
				continue
			}
			s.index.cacheRecord(v.path, rec)
		}
		rr := models.RunRecord{
			FileVersion:  rec.FileVersion,
			FilePath:     v.path,
			FileName:     rec.FileName,
			Stats:        rec.Stats,
			Performances: rec.Performances,
			Env:          rec.Env,
		}
		// Check if a screen recording exists for this run
		runBase := strings.TrimSuffix(filepath.Base(v.path), constants.RunFileExt)
		if _, ok := replays[runBase]; ok {
			rr.ScreenRecording = runBase
		}
		out = append(out, rr)
	}
	return out, nil
}

type recentFile struct {
	path string
	name string
	ts   int64
}

// selectRecentFiles returns the file paths to load, sorted oldest-to-newest.
// The listing and per-file timestamps come from the in-memory run index, so
// repeated history queries skip directory reads and file header opens.
func (s *Store) selectRecentFiles(limit int) ([]recentFile, error) {
	dir, err := s.runsDir()
	if err != nil {
		return nil, err
	}
	if err := s.index.ensureScanned(dir); err != nil {
		return nil, err
	}

	days := constants.DefaultRecentRunsDays
	minCount := constants.DefaultRecentRunsMinCount
	if s.settingsSvc != nil {
		cfg := s.settingsSvc.Get()
		if configured := cfg.RecentRunsDays; configured > 0 {
			days = configured
		}
		if configured := cfg.RecentRunsMinCount; configured > 0 {
			minCount = configured
		}
	}
	return s.index.recent(limit, days, minCount), nil
}

// runTimestampFromFileName resolves a run file's timestamp without reading the
// file: the Kovaak's-style name embeds the played date, so only files with
// unrecognizable names fall back to the header (then mtime). This keeps the
// run index scan a pure directory listing instead of one open per file.
func runTimestampFromFileName(fileName, path string) int64 {
	if info, err := kovaaks.ParseFilename(fileName); err == nil {
		return info.DatePlayed.UnixMilli()
	}

	if ts, ok := runEpochFromFile(path); ok {
		return ts
	}
	if fi, err := os.Stat(path); err == nil {
		return fi.ModTime().UnixMilli()
	}
	return 0
}

func candidateRunFileNames(statsFileName string) []string {
	statsName := filepath.Base(statsFileName)
	legacyName := strings.TrimSuffix(statsName, constants.StatsFileExt) + constants.RunFileExt
	v2Name := runFileNameFromStatsPath(statsName) + constants.RunFileExt
	if v2Name == legacyName {
		return []string{legacyName}
	}
	return []string{v2Name, legacyName}
}

func runEpochFromFile(path string) (int64, bool) {
	f, err := os.Open(path)
	if err != nil {
		return 0, false
	}
	defer f.Close()

	var magic [4]byte
	if _, err := io.ReadFull(f, magic[:]); err != nil {
		return 0, false
	}
	if string(magic[:]) != runMagic {
		return 0, false
	}

	var version uint8
	if err := binary.Read(f, binary.LittleEndian, &version); err != nil {
		return 0, false
	}
	if version != runVersionV1 && version != runVersionV2 {
		return 0, false
	}

	var compression uint8
	if err := binary.Read(f, binary.LittleEndian, &compression); err != nil {
		return 0, false
	}
	_ = compression

	var epochMilli int64
	if err := binary.Read(f, binary.LittleEndian, &epochMilli); err != nil {
		return 0, false
	}
	if epochMilli <= 0 {
		return 0, false
	}
	return epochMilli, true
}

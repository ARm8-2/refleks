package runs

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/runs/kovaaks"
	"refleks/internal/runs/screen"
	appsettings "refleks/internal/settings"
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

// replayFileSet scans the replays directory and returns a set of base names (without
// extension) that have replay files.
func (s *Store) replayFileSet() map[string]struct{} {
	dir, err := s.ReplaysDir()
	if err != nil {
		return nil
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
	return set
}

// Exists reports whether the given stats file already has a stored run record.
func (s *Store) Exists(statsFileName string) bool {
	dir, err := s.runsDir()
	if err != nil {
		return false
	}
	for _, runName := range candidateRunFileNames(statsFileName) {
		_, err = os.Stat(filepath.Join(dir, runName))
		if err == nil {
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
		rec, err := readRecordFile(v.path, readRecordOptions{skipStatsEvents: true, skipPerformanceEvents: true, skipMouseTrace: true})
		if err != nil {
			continue
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
func (s *Store) selectRecentFiles(limit int) ([]recentFile, error) {
	dir, err := s.runsDir()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	all := make([]recentFile, 0, len(entries))

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
	var cutoff int64
	if days > 0 {
		cutoff = time.Now().AddDate(0, 0, -days).UnixMilli()
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(e.Name()), constants.RunFileExt) {
			continue
		}

		path := filepath.Join(dir, e.Name())
		ts := runTimestampFromFileName(e.Name(), path)
		all = append(all, recentFile{path: path, name: e.Name(), ts: ts})
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].ts == all[j].ts {
			return all[i].name < all[j].name
		}
		return all[i].ts < all[j].ts
	})

	selectedStart := 0
	if cutoff > 0 {
		selectedStart = len(all)
		for i := len(all) - 1; i >= 0; i-- {
			if all[i].ts >= cutoff {
				selectedStart = i
			} else {
				break
			}
		}

		if minCount > 0 {
			minStart := len(all) - minCount
			if minStart < 0 {
				minStart = 0
			}
			if minStart < selectedStart {
				selectedStart = minStart
			}
		}

		if selectedStart > len(all) {
			selectedStart = len(all)
		}
	}

	selected := all[selectedStart:]
	if limit > 0 && len(selected) > limit {
		selected = selected[len(selected)-limit:]
	}

	return selected, nil
}

func runTimestampFromFileName(fileName, path string) int64 {
	if ts, ok := runEpochFromFile(path); ok {
		return ts
	}

	if info, err := kovaaks.ParseFilename(fileName); err == nil {
		return info.DatePlayed.UnixMilli()
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

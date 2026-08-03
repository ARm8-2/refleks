package runs

import (
	"fmt"
	"os"
	"path/filepath"
	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/runs/environment"
	"refleks/internal/runs/kovaaks"
	"refleks/internal/runs/screen"
	"refleks/internal/steam"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// pendingScreenTrim describes a run awaiting a screen-recording trim out of
// a capture session's rolling segment buffer.
type pendingScreenTrim struct {
	runPath      string
	runFileName  string
	dir          string // capture session's segment directory
	sessionStart time.Time
	runStart     time.Time
	runEnd       time.Time // scenario end used by stats/trace data
	replayEnd    time.Time // requested clip end, including a small post-run tail
}

// IngestRun parses a KovaaK's stats CSV, enriches it, persists it, and returns the stored record.
// If screen capture is configured and a recording was captured, it triggers async trimming.
func (s *Store) IngestRun(fullPath string, mouse models.MouseTraceProvider) (models.RunRecord, error) {
	info, err := kovaaks.ParseFilename(filepath.Base(fullPath))
	if err != nil {
		return models.RunRecord{}, err
	}
	stats, err := kovaaks.ParseStatsFile(fullPath)
	if err != nil {
		return models.RunRecord{}, err
	}

	stats.Summary.DatePlayed = info.DatePlayed.Format(time.RFC3339)

	hit := float64(stats.Summary.HitCount)
	miss := float64(stats.Summary.MissCount)
	if denom := hit + miss; denom > 0 {
		stats.Summary.Accuracy = hit / denom
	} else {
		stats.Summary.Accuracy = 0
	}

	if len(stats.Events) >= 2 {
		var times []time.Time
		for _, event := range stats.Events {
			if t, ok := parseTODOnDate(event.Timestamp, info.DatePlayed); ok {
				times = append(times, t)
			}
		}
		if len(times) >= 2 {
			var sum time.Duration
			for i := 1; i < len(times); i++ {
				if dt := times[i].Sub(times[i-1]); dt > 0 {
					sum += dt
				}
			}
			if intervals := len(times) - 1; intervals > 0 {
				stats.Summary.RealAvgTTK = sum.Seconds() / float64(intervals)
			}
		}
	}

	if cm, ok := cm360FromStats(stats.Summary); ok {
		stats.Summary.Cm360 = cm
	}

	start, end := deriveScenarioWindow(info.DatePlayed, stats.Summary, stats.Events)
	if !start.IsZero() && !end.IsZero() {
		stats.Summary.Duration = end.Sub(start).Seconds()
	}

	fileName := runFileNameFromStatsPath(fullPath)
	performanceData, err := parseMatchingPerformancesFile(fullPath)
	if err != nil {
		return models.RunRecord{}, err
	}

	rec := models.RunRecord{
		FileVersion:  runVersionCurrent,
		FilePath:     fullPath,
		FileName:     fileName,
		Stats:        stats,
		Performances: performanceData,
	}

	var steamID, personaName string
	if s.settingsSvc != nil {
		settings := s.settingsSvc.Get()
		steamID = steam.GetSteamID(settings)
		personaName = steam.GetPersonaName(settings)
	}

	var trace []models.MousePoint
	if mouse != nil && mouse.Enabled() {
		if !start.IsZero() && !end.IsZero() && start.Before(end) {
			trace = mouse.GetRange(start, end)
		}
	}

	runPath, err := s.Save(storedRunRecord{
		FileVersion:  runVersionCurrent,
		FileName:     rec.FileName,
		EpochMilli:   info.DatePlayed.UnixMilli(),
		Stats:        rec.Stats,
		Performances: rec.Performances,
		MouseTrace:   trace,
		Env:          environment.CollectRunEnvironment(mouse, start, end, len(trace), steamID, personaName),
	})
	if err != nil {
		return models.RunRecord{}, err
	}

	rec.FilePath = runPath

	// --- Screen capture: trim the session recording to the run window ---
	s.setReplayStatus(runPath, models.ReplayStateProcessing, "Processing replay…")
	s.scheduleScreenTrim(runPath, rec.FileName, start, end)

	return rec, nil
}

// scheduleScreenTrim looks up the active (or most recently stopped) capture
// session and attempts to trim the run's window out of it. If the segment
// covering the run's end hasn't closed yet, a short-lived goroutine polls
// for it to become available instead of queuing the run until the whole
// capture session (which may last the entire play session) stops.
func (s *Store) scheduleScreenTrim(runPath, runFileName string, start, end time.Time) {
	s.screenMu.Lock()
	provider := s.screenProvider
	encoder := s.encoder
	s.screenMu.Unlock()

	if provider == nil || encoder == nil || !encoder.Available() {
		runtime.LogDebugf(s.ctx, "screen/schedule: provider=%v encoder=%v available=%v", provider != nil, encoder != nil, encoder != nil && encoder.Available())
		s.setReplayStatus(runPath, models.ReplayStateUnavailable, "Screen capture was not available for this run.")
		return
	}

	dir, sessionStart := s.captureSessionForRun(provider, start, end)
	runtime.LogDebugf(s.ctx, "screen/schedule: run=%s session=%q enabled=%v", runFileName, dir, provider.Enabled())
	if dir == "" || sessionStart.IsZero() {
		s.setReplayStatus(runPath, models.ReplayStateUnavailable, "No capture session covered this run.")
		return
	}
	// The watcher may ingest historical files while a new capture session is
	// active. Clamping such a run to the start of the current session creates a
	// plausible-looking but completely unrelated replay, so reject it instead.
	if start.Before(sessionStart) || !end.After(sessionStart) {
		runtime.LogDebugf(s.ctx, "screen/schedule: run=%s is outside capture session", runFileName)
		s.setReplayStatus(runPath, models.ReplayStateUnavailable, "This run was outside the available capture session.")
		return
	}

	trim := pendingScreenTrim{
		runPath:      runPath,
		runFileName:  runFileName,
		dir:          dir,
		sessionStart: sessionStart,
		runStart:     start,
		runEnd:       end,
		replayEnd: end.Add(
			time.Duration(constants.ScreenCaptureReplayTailSeconds) * time.Second,
		),
	}

	s.screenMu.Lock()
	// Finalization retains stopped sessions briefly for late fsnotify events;
	// allow those runs to register instead of discarding their replay.
	s.screenTrimCounts[dir]++
	s.screenMu.Unlock()
	s.beginReplayTrim(runPath)

	go func() {
		defer s.finishScreenTrim(dir)
		defer s.finishReplayTrim(runPath)
		s.runScreenTrim(trim)
	}()
}

func captureSessionIsActive(provider screen.Provider, dir string) bool {
	if provider == nil || !provider.Enabled() {
		return false
	}
	currentDir, _ := provider.Session()
	return currentDir == dir
}

// runScreenTrim polls for the run's segments to become available (i.e. the
// segment covering the run's end has fully closed) and trims as soon as
// they are, instead of waiting for the capture session itself to stop.
func (s *Store) runScreenTrim(trim pendingScreenTrim) {
	deadline := time.Now().Add(time.Duration(constants.ScreenCaptureTrimMaxWaitSeconds) * time.Second)
	for {
		s.screenMu.Lock()
		provider := s.screenProvider
		s.screenMu.Unlock()
		if provider == nil {
			s.setReplayStatus(trim.runPath, models.ReplayStateFailed, "Capture stopped before replay processing completed.")
			return
		}

		paths, firstSegmentStart, ready := provider.Segments(
			trim.dir, trim.sessionStart, trim.runStart, trim.replayEnd,
		)
		if ready {
			// Segments leases the selected files so the rolling-retention prune
			// cannot remove one while ffmpeg is opening or copying it.
			if err := s.trimScreenRecording(trim, paths, firstSegmentStart); err != nil {
				s.setReplayStatus(trim.runPath, models.ReplayStateFailed, "Replay processing failed.")
			} else {
				s.setReplayStatus(trim.runPath, models.ReplayStateReady, "Replay is ready.")
			}
			provider.ReleaseSegments(paths)
			return
		}

		// A capture session that has stopped cannot produce the requested tail.
		// Export the complete scenario window instead of polling until timeout and
		// losing the replay entirely.
		if !captureSessionIsActive(provider, trim.dir) {
			fallback := trim
			fallback.replayEnd = trim.runEnd
			paths, firstSegmentStart, ready = provider.Segments(
				fallback.dir, fallback.sessionStart, fallback.runStart, fallback.replayEnd,
			)
			if ready {
				if err := s.trimScreenRecording(fallback, paths, firstSegmentStart); err != nil {
					s.setReplayStatus(trim.runPath, models.ReplayStateFailed, "Replay processing failed.")
				} else {
					s.setReplayStatus(trim.runPath, models.ReplayStateReady, "Replay is ready.")
				}
				provider.ReleaseSegments(paths)
				return
			}
			// A stopped or replaced session cannot produce any more segments. Do
			// not spend the full polling deadline waiting for an impossible tail.
			s.setReplayStatus(trim.runPath, models.ReplayStateFailed, "Capture segments did not cover the run window.")
			return
		}

		if time.Now().After(deadline) {
			runtime.LogWarningf(s.ctx, "screen/trim: gave up waiting for segments covering %s after %ds", trim.runFileName, constants.ScreenCaptureTrimMaxWaitSeconds)
			s.setReplayStatus(trim.runPath, models.ReplayStateFailed, "Timed out waiting for capture segments.")
			return
		}
		time.Sleep(time.Duration(constants.ScreenCaptureTrimPollInterval) * time.Second)
	}
}

// FinalizeScreenCapture releases the stopped capture session only after every
// trim bound to that exact session completes. A fixed grace period can delete
// segment files while ffmpeg is still reading them, yielding intermittent
// missing or unplayable replays.
func (s *Store) FinalizeScreenCapture() {
	s.screenMu.Lock()
	provider := s.screenProvider
	s.screenMu.Unlock()
	if provider == nil || provider.Enabled() {
		return
	}

	// Snapshot the stopped directory before another capture can start. Looking
	// it up after waiting can instead pick the next session and leak this one.
	dir, sessionStart := provider.Session()
	if dir == "" {
		return
	}

	s.screenMu.Lock()
	if !sessionStart.IsZero() {
		s.screenSessions[dir] = sessionStart
	}
	s.screenFinalizing[dir] = true
	pending := s.screenTrimCounts[dir]
	scheduleRelease := pending == 0 && !s.screenReleasePending[dir]
	if scheduleRelease {
		s.screenReleasePending[dir] = true
	}
	s.screenMu.Unlock()

	if scheduleRelease {
		go func() {
			time.Sleep(time.Duration(constants.ScreenCaptureFinalizeGraceSeconds) * time.Second)
			s.releaseFinalizedScreenSession(dir)
		}()
	}
}

func (s *Store) finishScreenTrim(dir string) {
	s.screenMu.Lock()
	if s.screenTrimCounts[dir] > 1 {
		s.screenTrimCounts[dir]--
		s.screenMu.Unlock()
		return
	}
	delete(s.screenTrimCounts, dir)
	release := s.screenFinalizing[dir]
	if release {
		delete(s.screenFinalizing, dir)
		delete(s.screenReleasePending, dir)
		delete(s.screenSessions, dir)
	}
	provider := s.screenProvider
	s.screenMu.Unlock()

	if release && provider != nil {
		provider.ReleaseSession(dir)
	}
}

func (s *Store) releaseFinalizedScreenSession(dir string) {
	s.screenMu.Lock()
	if !s.screenFinalizing[dir] || s.screenTrimCounts[dir] != 0 {
		delete(s.screenReleasePending, dir)
		s.screenMu.Unlock()
		return
	}
	delete(s.screenFinalizing, dir)
	delete(s.screenReleasePending, dir)
	delete(s.screenTrimCounts, dir)
	delete(s.screenSessions, dir)
	provider := s.screenProvider
	s.screenMu.Unlock()

	if provider != nil {
		provider.ReleaseSession(dir)
	}
}

// trimScreenRecording trims the run's segments down to the run window and
// atomically publishes the resulting replay only after ffmpeg succeeds.
func (s *Store) trimScreenRecording(trim pendingScreenTrim, paths []string, firstSegmentStart time.Duration) error {
	s.screenMu.Lock()
	encoder := s.encoder
	s.screenMu.Unlock()
	if encoder == nil {
		return fmt.Errorf("encoder is no longer available")
	}
	if len(paths) == 0 {
		runtime.LogWarningf(s.ctx, "screen/trim: no segments for %s", trim.runFileName)
		return fmt.Errorf("no capture segments were available")
	}

	outPath, err := s.ReplayPath(trim.runPath, encoder.Info().Container)
	if err != nil {
		runtime.LogWarningf(s.ctx, "screen/trim: replay path error: %v", err)
		return fmt.Errorf("replay path: %w", err)
	}
	s.replayMu.Lock()
	_, deleted := s.deletedReplays[trim.runPath]
	s.replayMu.Unlock()
	if deleted {
		return fmt.Errorf("replay was deleted while processing")
	}

	sessionStartMs := trim.sessionStart.UnixMilli()
	runStartMs := trim.runStart.UnixMilli()
	runEndMs := trim.replayEnd.UnixMilli()
	if runEndMs <= runStartMs {
		runtime.LogWarningf(s.ctx, "screen/trim: invalid run window for %s", trim.runFileName)
		return fmt.Errorf("invalid replay time window")
	}

	tmp, err := os.CreateTemp(filepath.Dir(outPath), "."+filepath.Base(outPath)+"-*.partial"+filepath.Ext(outPath))
	if err != nil {
		runtime.LogWarningf(s.ctx, "screen/trim: create temporary replay for %s: %v", trim.runFileName, err)
		return fmt.Errorf("create temporary replay: %w", err)
	}
	tmpPath := tmp.Name()
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		runtime.LogWarningf(s.ctx, "screen/trim: close temporary replay for %s: %v", trim.runFileName, err)
		return fmt.Errorf("close temporary replay: %w", err)
	}
	_ = os.Remove(tmpPath) // ffmpeg creates the file itself with -y.
	defer os.Remove(tmpPath)

	firstSegmentStartMs := sessionStartMs + firstSegmentStart.Milliseconds()
	if err := encoder.TrimRecording(paths, tmpPath, sessionStartMs, firstSegmentStartMs, runStartMs, runEndMs); err != nil {
		runtime.LogWarningf(s.ctx, "screen/trim: failed for %s: %v", trim.runFileName, err)
		return fmt.Errorf("trim replay: %w", err)
	}
	// Coordinate publishing with user deletion. Windows cannot rename over an
	// existing file, so move the old replay aside first and restore it if the
	// new rename fails rather than deleting a valid replay before replacement.
	s.replayMu.Lock()
	defer s.replayMu.Unlock()
	if _, deleted := s.deletedReplays[trim.runPath]; deleted {
		return fmt.Errorf("replay was deleted while processing")
	}
	backupPath := outPath + ".previous"
	_ = os.Remove(backupPath)
	if err := os.Rename(outPath, backupPath); err != nil && !os.IsNotExist(err) {
		runtime.LogWarningf(s.ctx, "screen/trim: prepare replay replacement for %s: %v", trim.runFileName, err)
		return fmt.Errorf("prepare replay replacement: %w", err)
	}
	if err := os.Rename(tmpPath, outPath); err != nil {
		if restoreErr := os.Rename(backupPath, outPath); restoreErr != nil && !os.IsNotExist(restoreErr) {
			runtime.LogWarningf(s.ctx, "screen/trim: publish replay for %s: %v; restore previous replay: %v", trim.runFileName, err, restoreErr)
		} else {
			runtime.LogWarningf(s.ctx, "screen/trim: publish replay for %s: %v; restored previous replay", trim.runFileName, err)
		}
		return fmt.Errorf("publish replay: %w", err)
	}
	_ = os.Remove(backupPath)

	runtime.LogInfof(s.ctx, "screen/trim: saved replay for %s at %s", trim.runFileName, outPath)
	return nil
}

func parseMatchingPerformancesFile(statsPath string) (*models.RunPerformanceData, error) {
	perfPath := matchingPerformancesPath(statsPath)
	for i := range constants.PerformancesFileMaxRetries {
		if _, err := os.Stat(perfPath); err != nil {
			if !os.IsNotExist(err) {
				return nil, err
			}
			// The performances file may not have been flushed yet; retry briefly.
			if i < constants.PerformancesFileMaxRetries-1 {
				time.Sleep(time.Duration(constants.PerformancesFileRetryIntervalMs) * time.Millisecond)
			}
			continue
		}
		return kovaaks.ParsePerformancesFile(perfPath)
	}
	return nil, nil
}

func matchingPerformancesPath(statsPath string) string {
	return filepath.Join(filepath.Dir(filepath.Dir(statsPath)), constants.KovaaksPerformancesDirName, performancesFileNameFromStatsPath(statsPath))
}

func runFileNameFromStatsPath(statsPath string) string {
	name := filepath.Base(statsPath)
	name = strings.TrimSuffix(name, constants.StatsFileExt)
	return strings.TrimSuffix(name, " Stats")
}

func performancesFileNameFromStatsPath(statsPath string) string {
	name := filepath.Base(statsPath)
	name = strings.TrimSuffix(name, constants.StatsFileExt)
	return strings.TrimSuffix(name, " Stats") + " Performance" + constants.PerformanceFileExt
}

func deriveScenarioWindow(end time.Time, stats models.RunStatsSummary, statsEvents []models.RunStatsEvent) (time.Time, time.Time) {
	var start time.Time
	if challengeStart := stats.ChallengeStart; challengeStart != "" {
		if t, ok := parseTODOnDate(challengeStart, end); ok {
			start = t
		}
	}
	if start.IsZero() && len(statsEvents) > 0 {
		if t, ok := parseTODOnDate(statsEvents[0].Timestamp, end); ok {
			start = t
		}
	}
	if start.IsZero() {
		start = end.Add(-60 * time.Second)
	}
	if start.After(end) {
		start = start.AddDate(0, 0, -1)
	}
	return start, end
}

func parseTODOnDate(s string, date time.Time) (time.Time, bool) {
	layouts := []string{
		"15:04:05.000000",
		"15:04:05.000",
		"15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return time.Date(date.Year(), date.Month(), date.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), date.Location()), true
		}
	}
	return time.Time{}, false
}

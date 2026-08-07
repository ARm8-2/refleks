package runs

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const replayStorageBytesPerGB int64 = 1024 * 1024 * 1024

type replayFile struct {
	path    string
	name    string
	modTime time.Time
	size    int64
}

// CleanupReplays deletes replay files older than retentionDays, then removes
// the oldest remaining files until the replay directory is within the storage
// limit. A value of zero disables either limit. The newest replay is retained
// when it alone exceeds the storage limit so a newly-created replay is never
// immediately deleted just because it is larger than the configured cap.
func (s *Store) CleanupReplays(ctx context.Context, retentionDays, storageLimitGB int) (int, error) {
	if retentionDays <= 0 && storageLimitGB <= 0 {
		return 0, nil
	}

	s.replayMu.Lock()
	defer s.replayMu.Unlock()

	dir, err := s.ReplaysDir()
	if err != nil {
		return 0, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, err
	}

	files := make([]replayFile, 0, len(entries))
	deleted := 0
	cutoff := time.Time{}
	if retentionDays > 0 {
		cutoff = time.Now().AddDate(0, 0, -retentionDays)
	}
	for _, entry := range entries {
		if entry.IsDir() || !isReplayFile(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		file := replayFile{
			path:    filepath.Join(dir, entry.Name()),
			name:    entry.Name(),
			modTime: info.ModTime(),
			size:    info.Size(),
		}
		if retentionDays > 0 && file.modTime.Before(cutoff) {
			if removeReplayFile(ctx, file.path) {
				deleted++
				continue
			}
		}
		files = append(files, file)
	}

	if storageLimitGB > 0 {
		limitBytes := int64(storageLimitGB) * replayStorageBytesPerGB
		var totalBytes int64
		for _, file := range files {
			totalBytes += file.size
		}

		if totalBytes > limitBytes && len(files) > 1 {
			sort.Slice(files, func(i, j int) bool {
				if files[i].modTime.Equal(files[j].modTime) {
					return files[i].name < files[j].name
				}
				return files[i].modTime.Before(files[j].modTime)
			})

			// Keep the newest replay even if it is larger than the cap by itself.
			newestPath := files[len(files)-1].path
			for _, file := range files {
				if totalBytes <= limitBytes || file.path == newestPath {
					continue
				}
				if removeReplayFile(ctx, file.path) {
					totalBytes -= file.size
					deleted++
				}
			}
		}
	}

	if deleted > 0 {
		s.invalidateReplaySet()
	}
	return deleted, nil
}

func isReplayFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".mp4" || ext == ".webm"
}

func removeReplayFile(ctx context.Context, path string) bool {
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return false
		}
		runtime.LogWarningf(ctx, "replay cleanup: remove %s: %v", path, err)
		return false
	}
	return true
}

// RequestReplayCleanup schedules an asynchronous cleanup pass. Multiple
// triggers that arrive while a pass is running are coalesced into one follow-up
// pass, preventing a burst of completed replays from creating concurrent
// directory scans or deletes.
func (s *Store) RequestReplayCleanup() {
	s.cleanupMu.Lock()
	if s.cleanupRunning {
		s.cleanupPending = true
		s.cleanupMu.Unlock()
		return
	}
	s.cleanupRunning = true
	s.cleanupMu.Unlock()

	go s.runReplayCleanup()
}

func (s *Store) runReplayCleanup() {
	for {
		settings := s.settingsSvc.Get()
		if settings.ReplayCleanupEnabled {
			deleted, err := s.CleanupReplays(
				s.cleanupContext(),
				settings.ReplayRetentionDays,
				settings.ReplayStorageLimitGB,
			)
			if err != nil {
				runtime.LogWarningf(s.cleanupContext(), "replay cleanup failed: %v", err)
			} else if deleted > 0 {
				runtime.LogInfof(s.cleanupContext(), "replay cleanup: deleted %d replay(s)", deleted)
			}
		}

		s.cleanupMu.Lock()
		if !s.cleanupPending {
			s.cleanupRunning = false
			s.cleanupMu.Unlock()
			return
		}
		s.cleanupPending = false
		s.cleanupMu.Unlock()
	}
}

func (s *Store) cleanupContext() context.Context {
	if s.ctx != nil {
		return s.ctx
	}
	return context.Background()
}

func (s *Store) invalidateReplaySet() {
	s.replaySetMu.Lock()
	s.replaySet = nil
	s.replaySetDir = ""
	s.replaySetMod = time.Time{}
	s.replaySetMu.Unlock()
}

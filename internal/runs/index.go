package runs

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"refleks/internal/constants"
)

// runIndexCacheCap bounds the number of parsed run summaries retained in
// memory. Progressive frontend batches repeatedly re-request the newest runs,
// so keeping those summaries (a few KB each) turns most reload work into map
// lookups; histories larger than the cap re-read older files from disk on
// demand. The cap bounds the cache to roughly 8-10 MB.
const runIndexCacheCap = 4096

// runIndex is an in-memory view of the .refleks run directory: a
// timestamp-sorted file list plus a bounded cache of parsed lightweight
// records. Store.Save keeps it current, and the run directory's modification
// time is verified on every access so external changes (manual edits,
// restores) trigger a rescan instead of serving a stale listing.
type runIndex struct {
	mu     sync.RWMutex
	dir    string
	files  []recentFile
	byName map[string]struct{}
	dirMod time.Time

	cache map[string]storedRunRecord
}

func newRunIndex() *runIndex {
	return &runIndex{
		byName: make(map[string]struct{}),
		cache:  make(map[string]storedRunRecord),
	}
}

// ensureScanned rebuilds the index from disk unless it is already current for
// the given directory. When up to date the check costs a single directory
// stat compared against the last known modification time.
func (ix *runIndex) ensureScanned(dir string) error {
	ix.mu.RLock()
	current := ix.dir == dir && len(ix.files) > 0
	mod := ix.dirMod
	ix.mu.RUnlock()
	if current {
		if fi, err := os.Stat(dir); err == nil && fi.ModTime().Equal(mod) {
			return nil
		}
	}
	return ix.scan(dir)
}

// scan lists the run directory and rebuilds the index and cache from scratch.
func (ix *runIndex) scan(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	files := make([]recentFile, 0, len(entries))
	byName := make(map[string]struct{}, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(e.Name()), constants.RunFileExt) {
			continue
		}
		path := filepath.Join(dir, e.Name())
		files = append(files, recentFile{
			path: path,
			name: e.Name(),
			ts:   runTimestampFromFileName(e.Name(), path),
		})
		byName[e.Name()] = struct{}{}
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].ts == files[j].ts {
			return files[i].name < files[j].name
		}
		return files[i].ts < files[j].ts
	})

	var mod time.Time
	if fi, err := os.Stat(dir); err == nil {
		mod = fi.ModTime()
	}

	ix.mu.Lock()
	ix.dir = dir
	ix.files = files
	ix.byName = byName
	ix.dirMod = mod
	// Cached records may be stale after an external change; start fresh.
	ix.cache = make(map[string]storedRunRecord)
	ix.mu.Unlock()
	return nil
}

// add inserts a newly saved run file into the index. The base directory state
// is loaded first so a run saved before any query cannot hide pre-existing
// files.
func (ix *runIndex) add(dir, name string, ts int64) {
	_ = ix.ensureScanned(dir)
	path := filepath.Join(dir, name)

	ix.mu.Lock()
	defer ix.mu.Unlock()

	if _, exists := ix.byName[name]; exists {
		// A re-saved file replaces its entry and drops any cached record.
		for i := range ix.files {
			if ix.files[i].name == name {
				ix.files[i] = recentFile{path: path, name: name, ts: ts}
				break
			}
		}
		delete(ix.cache, path)
	} else {
		ix.byName[name] = struct{}{}
		pos := sort.Search(len(ix.files), func(i int) bool {
			f := ix.files[i]
			return f.ts > ts || (f.ts == ts && f.name >= name)
		})
		ix.files = append(ix.files, recentFile{})
		copy(ix.files[pos+1:], ix.files[pos:])
		ix.files[pos] = recentFile{path: path, name: name, ts: ts}
	}

	// Record the directory modification time so this write is not mistaken
	// for an external change on the next access.
	if fi, err := os.Stat(dir); err == nil {
		ix.dirMod = fi.ModTime()
	}
}

// recent returns the files within the recent window in oldest-to-newest
// order, capped at limit entries (0 means no cap). The returned slice is a
// copy so callers never alias the index's backing array.
func (ix *runIndex) recent(limit, days, minCount int) []recentFile {
	ix.mu.RLock()
	defer ix.mu.RUnlock()

	all := ix.files
	var cutoff int64
	if days > 0 {
		cutoff = time.Now().AddDate(0, 0, -days).UnixMilli()
	}

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
	out := make([]recentFile, len(selected))
	copy(out, selected)
	return out
}

// contains reports whether a run file with the given name exists.
func (ix *runIndex) contains(name string) bool {
	ix.mu.RLock()
	_, ok := ix.byName[name]
	ix.mu.RUnlock()
	return ok
}

// cachedRecord returns a previously parsed lightweight record, if one is
// retained. Stored records are immutable; callers must not mutate them.
func (ix *runIndex) cachedRecord(path string) (storedRunRecord, bool) {
	ix.mu.RLock()
	rec, ok := ix.cache[path]
	ix.mu.RUnlock()
	return rec, ok
}

// cacheRecord stores a parsed lightweight record, evicting the oldest cached
// entries when the cache exceeds its cap.
func (ix *runIndex) cacheRecord(path string, rec storedRunRecord) {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	ix.cache[path] = rec
	ix.trimCacheLocked()
}

// trimCacheLocked drops the oldest cached records until the cache is back
// under its cap. Evicting in bulk keeps the cost amortized near-constant, and
// evicting oldest-first means the newest runs — the ones the UI re-requests
// most — are the last to go.
func (ix *runIndex) trimCacheLocked() {
	if len(ix.cache) <= runIndexCacheCap {
		return
	}
	target := runIndexCacheCap * 9 / 10
	for _, f := range ix.files {
		if len(ix.cache) <= target {
			return
		}
		delete(ix.cache, f.path)
	}
	// Safety net for entries not present in the file list.
	for path := range ix.cache {
		if len(ix.cache) <= target {
			return
		}
		delete(ix.cache, path)
	}
}

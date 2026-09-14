package runs

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func TestRunIndexScanFiltersAndSorts(t *testing.T) {
	dir := t.TempDir()
	write := func(name string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(dir, "nested"), 0o755); err != nil {
		t.Fatal(err)
	}

	newer := "b - Challenge - 2026.02.03-04.05.06.refleks"
	older := "a - Challenge - 2026.01.02-03.04.05.refleks"
	write(newer)
	write(older)
	write("notes.txt")

	ix := newRunIndex()
	if err := ix.scan(dir); err != nil {
		t.Fatalf("scan: %v", err)
	}

	if len(ix.files) != 2 {
		t.Fatalf("files = %d, want 2 (only .refleks)", len(ix.files))
	}
	// Sorted oldest to newest by embedded timestamp.
	if ix.files[0].name != older || ix.files[1].name != newer {
		t.Fatalf("order = [%s %s], want [%s %s]", ix.files[0].name, ix.files[1].name, older, newer)
	}
	if !ix.contains(older) || !ix.contains(newer) {
		t.Error("byName missing scanned files")
	}
	if ix.contains("notes.txt") {
		t.Error("non-run file should not be indexed")
	}
	if !ix.cachedRecordCountIs(0) {
		t.Error("scan should start with an empty cache")
	}
}

func TestRunIndexScanMissingDir(t *testing.T) {
	if err := newRunIndex().scan(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Fatal("expected error for missing directory")
	}
}

func TestRunIndexAddInsertsAndReplaces(t *testing.T) {
	dir := t.TempDir()
	ix := newRunIndex()

	ix.add(dir, "b.refleks", 200)
	ix.add(dir, "a.refleks", 100)
	ix.add(dir, "c.refleks", 300)

	if len(ix.files) != 3 {
		t.Fatalf("files = %d, want 3", len(ix.files))
	}
	want := []string{"a.refleks", "b.refleks", "c.refleks"}
	for i, name := range want {
		if ix.files[i].name != name {
			t.Fatalf("order = %v, want %v", ix.names(), want)
		}
	}

	// Re-adding an existing name replaces its entry in place and drops the
	// cached record for that path.
	ix.cacheRecord(ix.files[0].path, storedRunRecord{})
	ix.add(dir, "a.refleks", 400)
	if len(ix.files) != 3 {
		t.Fatalf("replace changed file count to %d", len(ix.files))
	}
	if !ix.cachedRecordCountIs(0) {
		t.Fatal("re-adding a file should drop its cached record")
	}
}

func TestRunIndexRecent(t *testing.T) {
	now := time.Now().UnixMilli()
	const dayMs = int64(24 * 60 * 60 * 1000)

	ix := newRunIndex()
	ix.files = []recentFile{
		{path: "/old", name: "old", ts: now - 30*dayMs},
		{path: "/mid", name: "mid", ts: now - dayMs},
		{path: "/new", name: "new", ts: now},
	}

	t.Run("no limits returns all", func(t *testing.T) {
		got := ix.recent(0, 0, 0)
		if len(got) != 3 {
			t.Fatalf("got %d files, want 3", len(got))
		}
	})

	t.Run("day cutoff drops old runs", func(t *testing.T) {
		got := ix.recent(0, 7, 0)
		if len(got) != 2 || got[0].name != "mid" || got[1].name != "new" {
			t.Fatalf("got %v, want [mid new]", names(got))
		}
	})

	t.Run("min count restores files older than the cutoff", func(t *testing.T) {
		got := ix.recent(0, 7, 5)
		if len(got) != 3 {
			t.Fatalf("got %v, want all three", names(got))
		}
	})

	t.Run("limit keeps the newest entries", func(t *testing.T) {
		got := ix.recent(1, 7, 5)
		if len(got) != 1 || got[0].name != "new" {
			t.Fatalf("got %v, want [new]", names(got))
		}
	})

	t.Run("returned slice does not alias the index", func(t *testing.T) {
		got := ix.recent(0, 0, 0)
		got[0].name = "mutated"
		if ix.files[0].name == "mutated" {
			t.Fatal("recent returned a slice aliasing the index")
		}
	})
}

func TestRunIndexCacheTrim(t *testing.T) {
	ix := newRunIndex()
	total := runIndexCacheCap + 100
	for i := 0; i < total; i++ {
		path := filepath.Join("/runs", "run-"+strconv.Itoa(i))
		ix.files = append(ix.files, recentFile{path: path, name: path, ts: int64(i)})
		ix.cache[path] = storedRunRecord{}
	}

	ix.trimCacheLocked()

	target := runIndexCacheCap * 9 / 10
	if len(ix.cache) != target {
		t.Fatalf("cache size = %d, want %d", len(ix.cache), target)
	}
	// Oldest entries are evicted first; the newest target entries remain.
	if _, ok := ix.cache[ix.files[0].path]; ok {
		t.Error("oldest cached entry should have been evicted")
	}
	if _, ok := ix.cache[ix.files[len(ix.files)-1].path]; !ok {
		t.Error("newest cached entry should be retained")
	}
}

func TestCandidateRunFileNames(t *testing.T) {
	got := candidateRunFileNames("Scenario - Challenge - 2026.01.02-03.04.05 Stats.csv")
	want := []string{
		"Scenario - Challenge - 2026.01.02-03.04.05.refleks",
		"Scenario - Challenge - 2026.01.02-03.04.05 Stats.refleks",
	}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("candidateRunFileNames = %v, want %v", got, want)
	}

	// Without the " Stats" suffix the two candidates collapse to one.
	got = candidateRunFileNames("plain.csv")
	if len(got) != 1 || got[0] != "plain.refleks" {
		t.Fatalf("candidateRunFileNames(plain.csv) = %v, want [plain.refleks]", got)
	}
}

func TestRunTimestampFromFileName(t *testing.T) {
	// A Kovaak's-style name resolves from the embedded date without opening the file.
	name := "Scenario - Challenge - 2026.01.02-03.04.05.refleks"
	want := time.Date(2026, 1, 2, 3, 4, 5, 0, time.Local).UnixMilli()
	if got := runTimestampFromFileName(name, filepath.Join(t.TempDir(), name)); got != want {
		t.Fatalf("timestamp from name = %d, want %d", got, want)
	}

	// An unrecognizable name falls back to the record's header epoch.
	path := writeTempRun(t, sampleRecord())
	if got := runTimestampFromFileName(filepath.Base(path), path); got != sampleRecord().EpochMilli {
		t.Fatalf("timestamp from header = %d, want %d", got, sampleRecord().EpochMilli)
	}
}

func TestIsReplayFile(t *testing.T) {
	tests := map[string]bool{
		"run.mp4":     true,
		"run.webm":    true,
		"RUN.MP4":     true,
		"run.mkv":     false,
		"run.mp4.tmp": false,
		"run":         false,
		"":            false,
	}
	for name, want := range tests {
		if got := isReplayFile(name); got != want {
			t.Errorf("isReplayFile(%q) = %v, want %v", name, got, want)
		}
	}
}

// cachedRecordCountIs reports whether the index cache is empty without taking
// the lock twice.
func (ix *runIndex) cachedRecordCountIs(n int) bool {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	return len(ix.cache) == n
}

func (ix *runIndex) names() []string {
	out := make([]string, len(ix.files))
	for i, f := range ix.files {
		out[i] = f.name
	}
	return out
}

func names(files []recentFile) []string {
	out := make([]string, len(files))
	for i, f := range files {
		out[i] = f.name
	}
	return out
}

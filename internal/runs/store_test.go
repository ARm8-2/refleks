package runs

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func TestStoreSaveRoundTripAndDetailLoads(t *testing.T) {
	s := newIsolatedStore(t)
	want := sampleRecord()
	want.FileName = "roundtrip"
	path, err := s.Save(want)
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	dir, err := s.runsDir()
	if err != nil {
		t.Fatal(err)
	}
	if expected := filepath.Join(dir, want.FileName+constants.RunFileExt); path != expected {
		t.Fatalf("Save path = %q, want %q", path, expected)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name() != filepath.Base(path) {
		t.Fatalf("Save left unexpected files: %v", entries)
	}

	// A new store must read the persisted data, not the original store's cache.
	s = NewStore(nil)
	got, err := readRecordFile(path, readRecordOptions{})
	if err != nil {
		t.Fatalf("read saved record: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("saved record mismatch\n got: %+v\nwant: %+v", got, want)
	}
	stats, err := s.LoadRunStatsEvents(path)
	if err != nil || !reflect.DeepEqual(stats, want.Stats.Events) {
		t.Fatalf("LoadRunStatsEvents = %+v, %v; want %+v", stats, err, want.Stats.Events)
	}
	performances, err := s.LoadRunPerformanceEvents(path)
	if err != nil || !reflect.DeepEqual(performances, want.Performances.Events) {
		t.Fatalf("LoadRunPerformanceEvents = %+v, %v; want %+v", performances, err, want.Performances.Events)
	}
	wantTrace, err := EncodeTraceBase64(want.MouseTrace)
	if err != nil {
		t.Fatal(err)
	}
	trace, err := s.LoadRunTrace(path)
	if err != nil || trace != wantTrace {
		t.Fatalf("LoadRunTrace = %q, %v; want %q", trace, err, wantTrace)
	}
}

func TestStoreSaveValidatesAndContainsFileNames(t *testing.T) {
	s := newIsolatedStore(t)
	for _, name := range []string{"", " \t\r\n"} {
		rec := sampleRecord()
		rec.FileName = name
		if path, err := s.Save(rec); err == nil || path != "" {
			t.Fatalf("Save(%q) = %q, %v; want empty path and error", name, path, err)
		}
	}
	dir, err := s.runsDir()
	if err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 0 {
		t.Fatalf("invalid names left files: %v, %v", entries, err)
	}

	// Save normalizes paths to their basename rather than rejecting them.
	for _, name := range []string{
		filepath.Join("..", "outside", "relative"),
		filepath.Join(t.TempDir(), "absolute"),
	} {
		rec := sampleRecord()
		rec.FileName = name
		path, err := s.Save(rec)
		if err != nil {
			t.Fatalf("Save(%q): %v", name, err)
		}
		if want := filepath.Join(dir, filepath.Base(name)+constants.RunFileExt); path != want {
			t.Fatalf("Save(%q) path = %q, want contained path %q", name, path, want)
		}
		if _, err := os.Stat(name + constants.RunFileExt); !os.IsNotExist(err) {
			t.Fatalf("Save wrote outside the runs directory: %q, %v", name, err)
		}
	}
}

func TestStoreRecentRunsFiltersOrdersAndLimits(t *testing.T) {
	s := newIsolatedStore(t)
	paths := make(map[string]string)
	for _, item := range []struct {
		name  string
		epoch int64
	}{{"newest", 1700000003000}, {"oldest", 1700000001000}, {"middle", 1700000002000}} {
		rec := sampleRecord()
		rec.FileName, rec.EpochMilli = item.name, item.epoch
		path, err := s.Save(rec)
		if err != nil {
			t.Fatal(err)
		}
		paths[item.name] = path
	}
	dir := filepath.Dir(paths["oldest"])
	writeStoreTestFile(t, filepath.Join(dir, "broken - Challenge - 2001.01.01-00.00.00.refleks"), []byte("corrupt"))
	writeStoreTestFile(t, filepath.Join(dir, "notes.txt"), []byte("not a run"))
	writeStoreTestFile(t, filepath.Join(dir, ".unfinished.refleks.tmp"), []byte("partial"))
	if err := os.Mkdir(filepath.Join(dir, "nested.refleks"), 0o755); err != nil {
		t.Fatal(err)
	}
	for name, ext := range map[string]string{"oldest": ".mkv", "middle": ".webm", "newest": ".mp4"} {
		path, err := s.ReplayPath(paths[name], ext)
		if err != nil {
			t.Fatal(err)
		}
		writeStoreTestFile(t, path, []byte("replay"))
	}
	fakeReplay, err := s.ReplayPath(paths["oldest"], ".mp4")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(fakeReplay, 0o755); err != nil {
		t.Fatal(err)
	}

	s = NewStore(nil)
	for _, limit := range []int{0, 0, 2} {
		got, err := s.LoadRecentRuns(limit)
		if err != nil {
			t.Fatalf("LoadRecentRuns(%d): %v", limit, err)
		}
		wantNames := []string{"oldest", "middle", "newest"}
		if limit == 2 {
			wantNames = wantNames[1:]
		}
		if len(got) != len(wantNames) {
			t.Fatalf("LoadRecentRuns(%d) returned %d records, want %d", limit, len(got), len(wantNames))
		}
		for i, name := range wantNames {
			run := got[i]
			if run.FileName != name || run.FilePath != paths[name] || run.FileVersion != runVersionCurrent {
				t.Errorf("record %d = %+v, want saved run %q", i, run, name)
			}
			if run.Stats.Summary != sampleRecord().Stats.Summary || run.Env != sampleRecord().Env {
				t.Errorf("summary/environment changed for %q", name)
			}
			if run.Stats.Events != nil || run.Performances == nil || run.Performances.Events != nil {
				t.Errorf("history should omit event lists but preserve performance metadata: %+v", run)
			} else if !reflect.DeepEqual(run.Performances.Header, sampleRecord().Performances.Header) {
				t.Errorf("performance header changed for %q", name)
			}
			wantReplay := name
			if name == "oldest" {
				wantReplay = ""
			}
			if run.ScreenRecording != wantReplay {
				t.Errorf("%q ScreenRecording = %q, want %q", name, run.ScreenRecording, wantReplay)
			}
		}
	}
}

func TestStoreExistsRecognizesCurrentAndLegacyNames(t *testing.T) {
	const base = "Scenario - Challenge - 2026.01.02-03.04.05"
	for _, storedName := range []string{base, base + " Stats"} {
		t.Run(storedName, func(t *testing.T) {
			s := newIsolatedStore(t)
			statsName := base + " Stats.csv"
			if s.Exists(statsName) {
				t.Fatal("unsaved stats file reported as existing")
			}
			rec := sampleRecord()
			rec.FileName = storedName
			if _, err := s.Save(rec); err != nil {
				t.Fatal(err)
			}
			for _, store := range []*Store{s, NewStore(nil)} {
				for _, name := range []string{statsName, filepath.Join(t.TempDir(), statsName)} {
					if !store.Exists(name) {
						t.Errorf("Exists(%q) = false for stored name %q", name, storedName)
					}
				}
				if store.Exists("unrelated Stats.csv") {
					t.Error("unrelated stats file reported as existing")
				}
			}
		})
	}
}

func TestStoreDetailLoadsEmptyAndErrors(t *testing.T) {
	s := newIsolatedStore(t)
	path, err := s.Save(storedRunRecord{FileName: "empty", EpochMilli: 1700000000000})
	if err != nil {
		t.Fatal(err)
	}
	stats, err := s.LoadRunStatsEvents(path)
	if err != nil || stats == nil || len(stats) != 0 {
		t.Fatalf("empty stats = %v, %v; want non-nil empty slice", stats, err)
	}
	performances, err := s.LoadRunPerformanceEvents(path)
	if err != nil || performances == nil || len(performances) != 0 {
		t.Fatalf("empty performances = %v, %v; want non-nil empty slice", performances, err)
	}
	trace, err := s.LoadRunTrace(path)
	if err != nil || trace != "" {
		t.Fatalf("empty trace = %q, %v; want empty string", trace, err)
	}

	badDir := t.TempDir()
	corrupt := filepath.Join(badDir, "corrupt.refleks")
	writeStoreTestFile(t, corrupt, []byte("not a run record"))
	for _, path := range []string{filepath.Join(badDir, "missing.refleks"), corrupt} {
		if _, err := s.LoadRunStatsEvents(path); err == nil {
			t.Errorf("LoadRunStatsEvents(%q) should fail", path)
		}
		if _, err := s.LoadRunPerformanceEvents(path); err == nil {
			t.Errorf("LoadRunPerformanceEvents(%q) should fail", path)
		}
		if _, err := s.LoadRunTrace(path); err == nil {
			t.Errorf("LoadRunTrace(%q) should fail", path)
		}
	}
}

func TestStoreReplayStatusAndDeletion(t *testing.T) {
	s := newIsolatedStore(t)
	rec := sampleRecord()
	rec.FileName = "replay"
	runPath, err := s.Save(rec)
	if err != nil {
		t.Fatal(err)
	}
	s.setReplayStatus(runPath, models.ReplayStateProcessing, "processing")
	if got := s.GetReplayStatus(runPath); got.State != models.ReplayStateProcessing || got.Message != "processing" {
		t.Fatalf("processing status = %+v", got)
	}
	var replayPaths []string
	for _, ext := range []string{".mp4", ".webm"} {
		path, err := s.ReplayPath(runPath, ext)
		if err != nil {
			t.Fatal(err)
		}
		writeStoreTestFile(t, path, []byte("replay"))
		replayPaths = append(replayPaths, path)
	}
	if got := s.GetReplayStatus(runPath); got.State != models.ReplayStateReady {
		t.Fatalf("published replay should override stale processing status: %+v", got)
	}
	keep := filepath.Join(filepath.Dir(replayPaths[0]), "other.mp4")
	writeStoreTestFile(t, keep, []byte("unrelated replay"))

	s.beginReplayTrim(runPath)
	s.beginReplayTrim(runPath)
	if err := s.DeleteReplay(runPath); err != nil {
		t.Fatalf("DeleteReplay: %v", err)
	}
	for _, path := range replayPaths {
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Errorf("deleted replay still exists: %q, %v", path, err)
		}
	}
	for _, path := range []string{runPath, keep} {
		if _, err := os.Stat(path); err != nil {
			t.Errorf("DeleteReplay should preserve %q: %v", path, err)
		}
	}
	if _, ok := s.deletedReplays[runPath]; !ok {
		t.Fatal("active trims must retain a deletion tombstone")
	}
	s.finishReplayTrim(runPath)
	if _, ok := s.deletedReplays[runPath]; !ok || s.activeReplayTrims[runPath] != 1 {
		t.Fatal("tombstone must survive until the last overlapping trim finishes")
	}
	s.finishReplayTrim(runPath)
	if len(s.deletedReplays) != 0 || len(s.activeReplayTrims) != 0 {
		t.Fatal("completed trims should not retain deletion bookkeeping")
	}
	if err := s.DeleteReplay(runPath); err != nil || len(s.deletedReplays) != 0 {
		t.Fatalf("repeated deletion should be a no-op: %v", err)
	}
	s.setReplayStatus(runPath, models.ReplayStateReady, "ready")
	if got := s.GetReplayStatus(runPath); got.State != models.ReplayStateUnavailable {
		t.Fatalf("without a replay or pending status, want unavailable: %+v", got)
	}
}

func writeStoreTestFile(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
}

package runs

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// newIsolatedStore points the app config dir at a temp home so replay cleanup
// operates entirely inside the test's sandbox.
func newIsolatedStore(t *testing.T) *Store {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	return NewStore(nil)
}

func TestCleanupReplaysRetention(t *testing.T) {
	s := newIsolatedStore(t)
	dir, err := s.ReplaysDir()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()

	create := func(name string, mod time.Time) string {
		t.Helper()
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte("data"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(path, mod, mod); err != nil {
			t.Fatal(err)
		}
		return path
	}

	old := create("old.mp4", now.AddDate(0, 0, -10))
	recentReplay := create("recent.webm", now.AddDate(0, 0, -1))
	nonReplay := create("notes.txt", now.AddDate(0, 0, -10))
	subdir := filepath.Join(dir, "subdir")
	if err := os.Mkdir(subdir, 0o755); err != nil {
		t.Fatal(err)
	}

	deleted, err := s.CleanupReplays(context.Background(), 5, 0)
	if err != nil {
		t.Fatalf("CleanupReplays: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted = %d, want 1", deleted)
	}
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Errorf("old replay not removed (err=%v)", err)
	}
	for _, keep := range []string{recentReplay, nonReplay, subdir} {
		if _, err := os.Stat(keep); err != nil {
			t.Errorf("%s should have been kept: %v", filepath.Base(keep), err)
		}
	}
}

func TestCleanupReplaysDisabled(t *testing.T) {
	s := newIsolatedStore(t)
	dir, err := s.ReplaysDir()
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "old.mp4")
	if err := os.WriteFile(path, []byte("data"), 0o600); err != nil {
		t.Fatal(err)
	}

	deleted, err := s.CleanupReplays(context.Background(), 0, 0)
	if err != nil {
		t.Fatalf("CleanupReplays: %v", err)
	}
	if deleted != 0 {
		t.Fatalf("deleted = %d, want 0 when both limits are disabled", deleted)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("disabled cleanup removed a file: %v", err)
	}
}

func TestCleanupReplaysStorageLimit(t *testing.T) {
	s := newIsolatedStore(t)
	dir, err := s.ReplaysDir()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()

	// Sparse files let us exceed the 1 GiB limit without allocating real space.
	oldest := filepath.Join(dir, "oldest.mp4")
	newest := filepath.Join(dir, "newest.mp4")
	if err := os.WriteFile(oldest, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(newest, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Truncate(oldest, 3<<30/2); err != nil {
		t.Skipf("sparse files unavailable: %v", err)
	}
	if err := os.Truncate(newest, 1<<29); err != nil {
		t.Skipf("sparse files unavailable: %v", err)
	}
	if err := os.Chtimes(oldest, now.Add(-2*time.Hour), now.Add(-2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(newest, now, now); err != nil {
		t.Fatal(err)
	}

	deleted, err := s.CleanupReplays(context.Background(), 0, 1)
	if err != nil {
		t.Fatalf("CleanupReplays: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted = %d, want 1", deleted)
	}
	if _, err := os.Stat(oldest); !os.IsNotExist(err) {
		t.Errorf("oldest replay not removed (err=%v)", err)
	}
	if _, err := os.Stat(newest); err != nil {
		t.Errorf("newest replay should be kept: %v", err)
	}
}

func TestCleanupReplaysKeepsSoleOversizedReplay(t *testing.T) {
	s := newIsolatedStore(t)
	dir, err := s.ReplaysDir()
	if err != nil {
		t.Fatal(err)
	}

	only := filepath.Join(dir, "only.mp4")
	if err := os.WriteFile(only, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Truncate(only, 2<<30); err != nil {
		t.Skipf("sparse files unavailable: %v", err)
	}

	deleted, err := s.CleanupReplays(context.Background(), 0, 1)
	if err != nil {
		t.Fatalf("CleanupReplays: %v", err)
	}
	if deleted != 0 {
		t.Fatalf("deleted = %d, want 0 (newest replay must survive)", deleted)
	}
	if _, err := os.Stat(only); err != nil {
		t.Fatalf("sole replay was removed: %v", err)
	}
}

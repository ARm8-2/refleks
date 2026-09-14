package cache

import (
	"os"
	"path/filepath"
	"testing"

	"refleks/internal/settings"
)

type testPayload struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// newIsolatedCache points the app config dir at a temp home so cache files land
// in the test's sandbox.
func newIsolatedCache(t *testing.T) *Service {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	return NewService()
}

func TestCacheRoundTrip(t *testing.T) {
	svc := newIsolatedCache(t)

	if svc.Exists("data.json") {
		t.Fatal("cache file should not exist yet")
	}

	want := testPayload{Name: "x", Count: 3}
	if err := svc.Save("data.json", want); err != nil {
		t.Fatalf("Save: %v", err)
	}
	if !svc.Exists("data.json") {
		t.Fatal("Exists = false after Save")
	}

	var got testPayload
	if err := svc.Load("data.json", &got); err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != want {
		t.Fatalf("loaded %+v, want %+v", got, want)
	}
}

func TestCacheLoadMissing(t *testing.T) {
	svc := newIsolatedCache(t)

	var got testPayload
	if err := svc.Load("missing.json", &got); err == nil {
		t.Fatal("expected error loading a missing cache file")
	}
}

func TestCacheClearAll(t *testing.T) {
	svc := newIsolatedCache(t)
	if err := svc.Save("a.json", testPayload{Name: "a"}); err != nil {
		t.Fatal(err)
	}
	if err := svc.Save("b.json", testPayload{Name: "b"}); err != nil {
		t.Fatal(err)
	}

	calls := 0
	svc.RegisterOnClear(func() { calls++ })
	svc.RegisterOnClear(func() { calls++ })

	if err := svc.ClearAll(); err != nil {
		t.Fatalf("ClearAll: %v", err)
	}
	if calls != 2 {
		t.Fatalf("clear callbacks = %d, want 2", calls)
	}
	if svc.Exists("a.json") || svc.Exists("b.json") {
		t.Fatal("cache files should be removed by ClearAll")
	}

	base, err := settings.GetConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(base, "cache"))
	if err != nil || !info.IsDir() {
		t.Fatalf("cache dir not recreated: info=%v err=%v", info, err)
	}
}

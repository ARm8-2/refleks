package updater

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"refleks/internal/constants"
)

func TestSanitizeVer(t *testing.T) {
	tests := map[string]string{
		"v1.2.3":  "1.2.3",
		"V1.2.3":  "1.2.3",
		" 1.2.3 ": "1.2.3",
		"1.2.3":   "1.2.3",
		"v 1.2.3": "1.2.3",
		"":        "",
		"v":       "",
	}
	for in, want := range tests {
		if got := sanitizeVer(in); got != want {
			t.Errorf("sanitizeVer(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCompareSemver(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.2.3", "1.2.3", 0},
		{"v1.2.3", "1.2.3", 0},
		{"1.2.3", "1.2.4", -1},
		{"1.2.4", "1.2.3", 1},
		{"1.2", "1.2.0", 0},
		{"1", "1.0.0", 0},
		{"2.0.0", "1.9.9", 1},
		{"1.10.0", "1.9.0", 1},
		{"1.9.0", "1.10.0", -1},
		{"1.2.3-beta", "1.2.3", 0},
		{"not-a-version", "1.0.0", -1},
	}
	for _, tt := range tests {
		if got := CompareSemver(tt.a, tt.b); got != tt.want {
			t.Errorf("CompareSemver(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestCleanupAbandonedDownloads(t *testing.T) {
	root := t.TempDir()

	staleDir := filepath.Join(root, constants.UpdaterTempDirPrefix+"stale")
	if err := os.Mkdir(staleDir, 0o755); err != nil {
		t.Fatal(err)
	}
	keepDir := filepath.Join(root, "keep")
	if err := os.Mkdir(keepDir, 0o755); err != nil {
		t.Fatal(err)
	}
	// A file sharing the prefix must not be removed (only directories are stale).
	staleFile := filepath.Join(root, constants.UpdaterTempDirPrefix+"file")
	if err := os.WriteFile(staleFile, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := cleanupAbandonedDownloads(root); err != nil {
		t.Fatalf("cleanupAbandonedDownloads: %v", err)
	}

	if _, err := os.Stat(staleDir); !os.IsNotExist(err) {
		t.Errorf("stale dir still present (err=%v)", err)
	}
	if _, err := os.Stat(keepDir); err != nil {
		t.Errorf("unrelated dir removed: %v", err)
	}
	if _, err := os.Stat(staleFile); err != nil {
		t.Errorf("prefixed file removed: %v", err)
	}
}

func TestCleanupAbandonedDownloadsMissingRoot(t *testing.T) {
	if err := cleanupAbandonedDownloads(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Fatal("expected error for missing root")
	}
}

func TestBuildDownloadURL(t *testing.T) {
	u := New("owner", "repo", "1.0.0")

	if _, err := u.BuildDownloadURL(""); err == nil {
		t.Fatal("expected error for empty version")
	}

	got, err := u.BuildDownloadURL("1.2.3")
	if runtime.GOOS != "windows" {
		if !errors.Is(err, ErrUnsupportedOS) {
			t.Fatalf("err = %v, want ErrUnsupportedOS", err)
		}
		return
	}

	if err != nil {
		t.Fatalf("BuildDownloadURL: %v", err)
	}
	asset := "refleks-1.2.3-windows-amd64-installer.exe"
	want := "https://github.com/owner/repo/releases/download/1.2.3/" + asset
	if got != want {
		t.Fatalf("BuildDownloadURL = %q, want %q", got, want)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func stubResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestLatest(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		u := &Updater{Owner: "owner", Repo: "repo", client: &http.Client{
			Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if got := r.Header.Get("Accept"); got != "application/vnd.github+json" {
					t.Errorf("Accept = %q", got)
				}
				if got := r.Header.Get("User-Agent"); got != "refleks-updater" {
					t.Errorf("User-Agent = %q", got)
				}
				return stubResponse(http.StatusOK, `{"tag_name":"v1.4.0","body":"release notes"}`), nil
			}),
		}}

		version, notes, err := u.Latest(context.Background())
		if err != nil {
			t.Fatalf("Latest: %v", err)
		}
		if version != "1.4.0" || notes != "release notes" {
			t.Fatalf("got (%q, %q), want (1.4.0, release notes)", version, notes)
		}
	})

	t.Run("non-200 status", func(t *testing.T) {
		u := &Updater{client: &http.Client{
			Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				return stubResponse(http.StatusForbidden, `{"message":"rate limited"}`), nil
			}),
		}}
		if _, _, err := u.Latest(context.Background()); err == nil {
			t.Fatal("expected error for non-200 status")
		}
	})

	t.Run("malformed json", func(t *testing.T) {
		u := &Updater{client: &http.Client{
			Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				return stubResponse(http.StatusOK, `{not json`), nil
			}),
		}}
		if _, _, err := u.Latest(context.Background()); err == nil {
			t.Fatal("expected error for malformed json")
		}
	})

	t.Run("empty tag", func(t *testing.T) {
		u := &Updater{client: &http.Client{
			Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				return stubResponse(http.StatusOK, `{"tag_name":"v","body":""}`), nil
			}),
		}}
		if _, _, err := u.Latest(context.Background()); err == nil {
			t.Fatal("expected error for empty version")
		}
	})
}

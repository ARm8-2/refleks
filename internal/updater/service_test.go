package updater

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"runtime"
	"testing"

	"refleks/internal/constants"
)

func TestServiceCheckForUpdates(t *testing.T) {
	for _, tt := range []struct {
		name          string
		current       string
		latest        string
		wantLatest    string
		wantHasUpdate bool
	}{
		{name: "new release available", current: "1.2.3", latest: "v1.2.4", wantLatest: "1.2.4", wantHasUpdate: true},
		{name: "already current", current: "1.2.4", latest: "1.2.4", wantLatest: "1.2.4"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			withUpdaterDefaultTransport(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method != http.MethodGet || req.URL.String() != fmt.Sprintf(constants.GitHubLatestReleaseAPI, "owner", "repo") {
					t.Errorf("request = %s %s, want GET latest release endpoint", req.Method, req.URL)
				}
				if got := req.Header.Get("User-Agent"); got != "refleks-updater" {
					t.Errorf("User-Agent = %q, want refleks-updater", got)
				}
				body := fmt.Sprintf(`{"tag_name":%q,"body":"release notes"}`, tt.latest)
				return stubResponse(http.StatusOK, body), nil
			}))

			service := NewService("owner", "repo", tt.current)
			got, err := service.CheckForUpdates(context.Background())
			if err != nil {
				t.Fatalf("CheckForUpdates: %v", err)
			}
			if got.CurrentVersion != tt.current || got.LatestVersion != tt.wantLatest || got.HasUpdate != tt.wantHasUpdate || got.ReleaseNotes != "release notes" {
				t.Fatalf("UpdateInfo = %+v", got)
			}
			if tt.wantHasUpdate && runtime.GOOS == "windows" && got.DownloadURL == "" {
				t.Error("available Windows update has no download URL")
			}
			if (!tt.wantHasUpdate || runtime.GOOS != "windows") && got.DownloadURL != "" {
				t.Errorf("DownloadURL = %q, want empty", got.DownloadURL)
			}
		})
	}
}

func TestServiceCheckForUpdatesWrapsAPIError(t *testing.T) {
	withUpdaterDefaultTransport(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
		return stubResponse(http.StatusServiceUnavailable, "try later"), nil
	}))

	service := NewService("owner", "repo", "1.2.3")
	info, err := service.CheckForUpdates(context.Background())
	if err == nil {
		t.Fatal("CheckForUpdates succeeded despite an upstream failure")
	}
	if info.CurrentVersion != "1.2.3" {
		t.Errorf("failure response current version = %q, want 1.2.3", info.CurrentVersion)
	}
	assertUpdateErrorCode(t, err, constants.UpdateCheckFailed)
}

func TestWrapUpdateErrorSelectsCodeAndPreservesCause(t *testing.T) {
	cause := errors.New("installer launch failed")
	if got := wrapUpdateError(cause); !errors.Is(got, cause) {
		t.Fatalf("generic update error %v does not preserve cause", got)
	} else {
		assertUpdateErrorCode(t, got, constants.UpdateDownloadFailed)
	}
	if got := wrapUpdateError(ErrUnsupportedOS); !errors.Is(got, ErrUnsupportedOS) {
		t.Fatalf("unsupported-OS error %v does not preserve cause", got)
	} else {
		assertUpdateErrorCode(t, got, constants.UpdateUnsupportedOS)
	}
}

func withUpdaterDefaultTransport(t *testing.T, transport http.RoundTripper) {
	t.Helper()
	previous := http.DefaultTransport
	http.DefaultTransport = transport
	t.Cleanup(func() { http.DefaultTransport = previous })
}

func assertUpdateErrorCode(t *testing.T, err error, want string) {
	t.Helper()
	var coded *constants.CodedError
	if !errors.As(err, &coded) || coded.Code != want {
		t.Fatalf("error = %v, coded error = %+v; want code %q", err, coded, want)
	}
}

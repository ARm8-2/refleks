package updater

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"refleks/internal/constants"
)

// Updater provides update checking and installation helpers.
// It targets Windows with an NSIS installer.
// API is consumed by app.go; keep method names stable.
type Updater struct {
	Owner   string
	Repo    string
	Current string
	client  *http.Client
}

// New constructs a new Updater.
func New(owner, repo, current string) *Updater {
	return &Updater{
		Owner:   owner,
		Repo:    repo,
		Current: sanitizeVer(current),
		client:  &http.Client{Timeout: time.Duration(constants.UpdaterHTTPTimeoutSeconds) * time.Second},
	}
}

// sanitizeVer trims a leading 'v' and whitespace.
func sanitizeVer(v string) string {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(v, "v") || strings.HasPrefix(v, "V") {
		return strings.TrimSpace(v[1:])
	}
	return v
}

// CompareSemver compares version strings like 1.2.3.
// Returns -1 if a<b, 0 if equal, +1 if a>b.
func CompareSemver(a, b string) int {
	a = sanitizeVer(a)
	b = sanitizeVer(b)
	as := strings.Split(a, ".")
	bs := strings.Split(b, ".")
	for len(as) < 3 {
		as = append(as, "0")
	}
	for len(bs) < 3 {
		bs = append(bs, "0")
	}
	for i := 0; i < 3; i++ {
		ai := parseInt(as[i])
		bi := parseInt(bs[i])
		if ai < bi {
			return -1
		}
		if ai > bi {
			return 1
		}
	}
	return 0
}

func parseInt(s string) int {
	n := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < '0' || c > '9' {
			break
		}
		n = n*10 + int(c-'0')
	}
	return n
}

type ghRelease struct {
	TagName string `json:"tag_name"`
	Body    string `json:"body"`
}

// Latest queries GitHub for the latest release tag and returns (version, notes).
func (u *Updater) Latest(ctx context.Context) (string, string, error) {
	api := fmt.Sprintf(constants.GitHubLatestReleaseAPI, u.Owner, u.Repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, api, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "refleks-updater")
	resp, err := u.client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("github api status %d", resp.StatusCode)
	}
	var r ghRelease
	dec := json.NewDecoder(resp.Body)
	if err := dec.Decode(&r); err != nil {
		return "", "", err
	}
	v := sanitizeVer(r.TagName)
	if v == "" {
		return "", "", errors.New("empty latest version")
	}
	return v, r.Body, nil
}

// BuildDownloadURL builds the expected installer URL for a given version and current OS.
func (u *Updater) BuildDownloadURL(version string) (string, error) {
	version = sanitizeVer(version)
	if version == "" {
		return "", errors.New("empty version")
	}
	if runtime.GOOS != "windows" {
		return "", errors.New("auto-update currently supported on Windows only")
	}
	asset := fmt.Sprintf(constants.WindowsInstallerNameFmt, version)
	url := fmt.Sprintf(constants.GitHubDownloadURLFmt, u.Owner, u.Repo, version, asset)
	return url, nil
}

// Download downloads the installer to a temporary path. Returns the absolute filepath.
func (u *Updater) Download(ctx context.Context, version string) (string, error) {
	url, err := u.BuildDownloadURL(version)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "refleks-updater")
	// Use a longer timeout for downloading larger assets
	dlClient := &http.Client{Timeout: time.Duration(constants.UpdaterDownloadTimeoutSeconds) * time.Second}
	resp, err := dlClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download status %d", resp.StatusCode)
	}
	tmpDir, err := os.MkdirTemp("", "refleks-update-")
	if err != nil {
		return "", err
	}
	fileName := fmt.Sprintf(constants.WindowsInstallerNameFmt, version)
	path := filepath.Join(tmpDir, fileName)
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, resp.Body); err != nil {
		return "", err
	}
	_ = os.Chmod(path, 0o755)
	return path, nil
}

// LaunchInstaller starts the downloaded installer and returns immediately.
// The caller is expected to quit the app after this returns nil.
func (u *Updater) LaunchInstaller(ctx context.Context, path string) error {
	// Intentionally ignore ctx for the child process to avoid cancellation
	// when the app quits. The installer must continue independently.
	if runtime.GOOS != "windows" {
		return errors.New("auto-update currently supported on Windows only")
	}
	return launchInstallerDetached(path)
}

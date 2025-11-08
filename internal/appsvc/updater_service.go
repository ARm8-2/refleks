package appsvc

import (
	"context"
	"time"

	"refleks/internal/models"
	"refleks/internal/updater"
)

// UpdaterService centralizes update-related app logic so UI wiring stays thin.
type UpdaterService struct {
	owner   string
	repo    string
	current string
}

// NewUpdaterService constructs a new service. Owner/repo/current are forwarded to the internal updater helper.
func NewUpdaterService(owner, repo, current string) *UpdaterService {
	return &UpdaterService{owner: owner, repo: repo, current: current}
}

// CheckForUpdates queries upstream and returns an UpdateInfo model.
func (s *UpdaterService) CheckForUpdates(ctx context.Context) (models.UpdateInfo, error) {
	u := updater.New(s.owner, s.repo, s.current)
	cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	latest, notes, err := u.Latest(cctx)
	if err != nil {
		return models.UpdateInfo{CurrentVersion: s.current}, err
	}
	has := updater.CompareSemver(s.current, latest) < 0
	info := models.UpdateInfo{
		CurrentVersion: s.current,
		LatestVersion:  latest,
		HasUpdate:      has,
		ReleaseNotes:   notes,
	}
	if has {
		if url, err := u.BuildDownloadURL(latest); err == nil {
			info.DownloadURL = url
		}
	}
	return info, nil
}

// DownloadAndInstallUpdate downloads and launches the installer for the specified or latest version.
// Returns an error if any step fails. The caller is responsible for quitting the app if desired.
func (s *UpdaterService) DownloadAndInstallUpdate(ctx context.Context, version string) error {
	u := updater.New(s.owner, s.repo, s.current)
	if version == "" {
		cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		latest, _, err := u.Latest(cctx)
		if err != nil {
			return err
		}
		version = latest
	}
	dctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	path, err := u.Download(dctx, version)
	if err != nil {
		return err
	}
	if err := u.LaunchInstaller(dctx, path); err != nil {
		return err
	}
	return nil
}

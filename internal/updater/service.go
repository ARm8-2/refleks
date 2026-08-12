package updater

import (
	"context"
	"errors"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// Service centralizes update-related app logic so UI wiring stays thin.
type Service struct {
	owner   string
	repo    string
	current string
}

// NewService constructs a new service. Owner/repo/current are forwarded to the internal updater helper.
func NewService(owner, repo, current string) *Service {
	return &Service{owner: owner, repo: repo, current: current}
}

// CheckForUpdates queries upstream and returns an UpdateInfo model.
func (s *Service) CheckForUpdates(ctx context.Context) (models.UpdateInfo, error) {
	u := New(s.owner, s.repo, s.current)
	cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	latest, notes, err := u.Latest(cctx)
	if err != nil {
		return models.UpdateInfo{CurrentVersion: s.current}, constants.WrapCoded(constants.UpdateCheckFailed, err)
	}
	has := CompareSemver(s.current, latest) < 0
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
func (s *Service) DownloadAndInstallUpdate(ctx context.Context, version string) error {
	u := New(s.owner, s.repo, s.current)
	if version == "" {
		latest, _, err := u.Latest(ctx)
		if err != nil {
			return constants.WrapCoded(constants.UpdateDownloadFailed, err)
		}
		version = latest
	}
	path, err := u.Download(ctx, version)
	if err != nil {
		return wrapUpdateError(err)
	}
	if err := u.LaunchInstaller(ctx, path); err != nil {
		return wrapUpdateError(err)
	}
	return nil
}

// wrapUpdateError attaches a message code, keeping the unsupported-OS case
// distinguishable from generic download/launch failures.
func wrapUpdateError(err error) error {
	if errors.Is(err, ErrUnsupportedOS) {
		return constants.WrapCoded(constants.UpdateUnsupportedOS, err)
	}
	return constants.WrapCoded(constants.UpdateDownloadFailed, err)
}

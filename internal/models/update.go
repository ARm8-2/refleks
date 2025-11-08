package models

// UpdateInfo describes application update availability and metadata exchanged over IPC.
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	DownloadURL    string `json:"downloadUrl,omitempty"`
	ReleaseNotes   string `json:"releaseNotes,omitempty"`
}

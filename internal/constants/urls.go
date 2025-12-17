package constants

const (
	// Kovaaks player progress endpoint. Use fmt.Sprintf with benchmarkId and steamId.
	KovaaksPlayerProgressURL = "https://kovaaks.com/webapp-backend/benchmarks/player-progress-rank-benchmark?benchmarkId=%d&steamId=%s"

	// Kovaaks last scores endpoint. Use fmt.Sprintf with username and scenarioName.
	KovaaksLastScoresURL = "https://kovaaks.com/webapp-backend/user/scenario/last-scores/by-name?username=%s&scenarioName=%s"

	// --- Updater/GitHub release info ---
	// GitHub repository owner/name used for update checks and downloads
	GitHubOwner = "ARm8-2"
	GitHubRepo  = "refleks"
	// GitHub API endpoint to retrieve the latest release metadata
	GitHubLatestReleaseAPI = "https://api.github.com/repos/%s/%s/releases/latest"
	// Direct download URL format for release assets
	// Usage: fmt.Sprintf(GitHubDownloadURLFmt, GitHubOwner, GitHubRepo, version, assetName)
	GitHubDownloadURLFmt = "https://github.com/%s/%s/releases/download/%s/%s"
)

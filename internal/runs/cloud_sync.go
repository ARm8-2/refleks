package runs

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"refleks/internal/constants"
	appsettings "refleks/internal/settings"
)

// CloudSyncClient uploads newly ingested .refleks files to the configured cloud endpoint.
type CloudSyncClient struct {
	endpoint string
	client   *http.Client
}

// NewCloudSyncClient constructs a sync client using env override or default endpoint.
func NewCloudSyncClient() *CloudSyncClient {
	return &CloudSyncClient{
		endpoint: resolveRunsSyncEndpoint(),
		client: &http.Client{
			Timeout: time.Duration(constants.RunsSyncHTTPTimeoutSeconds) * time.Second,
		},
	}
}

func resolveRunsSyncEndpoint() string {
	if env := strings.TrimSpace(appsettings.GetEnv(constants.EnvRunsSyncURLVar)); env != "" {
		return env
	}
	return constants.RefleksRunsSyncURL
}

// SyncRunFile posts the complete .refleks file bytes to the configured endpoint.
func (c *CloudSyncClient) SyncRunFile(ctx context.Context, runPath string) error {
	if c == nil {
		return fmt.Errorf("run sync client is nil")
	}
	endpoint := strings.TrimSpace(c.endpoint)
	if endpoint == "" {
		return fmt.Errorf("missing run sync endpoint")
	}
	if strings.TrimSpace(runPath) == "" {
		return fmt.Errorf("missing run path")
	}

	f, err := os.Open(runPath)
	if err != nil {
		return fmt.Errorf("open run file: %w", err)
	}
	defer f.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, f)
	if err != nil {
		return fmt.Errorf("build sync request: %w", err)
	}
	if info, statErr := f.Stat(); statErr == nil && info.Size() >= 0 {
		req.ContentLength = info.Size()
	}

	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-Refleks-File-Name", filepath.Base(runPath))
	req.Header.Set("X-Refleks-App-Version", constants.AppVersion)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send sync request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			return fmt.Errorf("sync request failed with status %d", resp.StatusCode)
		}
		return fmt.Errorf("sync request failed with status %d: %s", resp.StatusCode, msg)
	}

	return nil
}

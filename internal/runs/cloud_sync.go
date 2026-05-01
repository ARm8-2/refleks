package runs

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
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

// SyncRunFile posts the run file to the configured endpoint, optionally scrubbing identifying environment fields.
func (c *CloudSyncClient) SyncRunFile(ctx context.Context, runPath string, anonymous bool) error {
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

	body, closeBody, contentLength, err := buildSyncPayload(runPath, anonymous)
	if err != nil {
		return err
	}
	defer func() {
		_ = closeBody()
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return fmt.Errorf("build sync request: %w", err)
	}
	if contentLength >= 0 {
		req.ContentLength = contentLength
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

func buildSyncPayload(runPath string, anonymous bool) (io.Reader, func() error, int64, error) {
	if !anonymous {
		f, err := os.Open(runPath)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("open run file: %w", err)
		}

		contentLength := int64(-1)
		if info, statErr := f.Stat(); statErr == nil && info.Size() >= 0 {
			contentLength = info.Size()
		}
		return f, f.Close, contentLength, nil
	}

	rec, err := readRecordFile(runPath, readRecordOptions{})
	if err != nil {
		return nil, nil, 0, fmt.Errorf("read run file for anonymous sync: %w", err)
	}
	rec.Env = anonymizeRunEnvironment(rec.Env)

	var payload bytes.Buffer
	if err := writeRecord(&payload, rec); err != nil {
		return nil, nil, 0, fmt.Errorf("encode anonymized run file: %w", err)
	}

	return bytes.NewReader(payload.Bytes()), func() error { return nil }, int64(payload.Len()), nil
}

func anonymizeRunEnvironment(env models.RunEnvironment) models.RunEnvironment {
	env.SteamID = ""
	env.PersonaName = ""
	return env
}

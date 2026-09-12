package benchmarks

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"refleks/internal/constants"
	"refleks/internal/steam"
)

const (
	maxProgressRetries       = 5
	initialProgressRetryWait = 30 * time.Second
	maxProgressRetryWait     = 5 * time.Minute
	maxProgressErrorBodySize = 1024
	maxProgressBodySize      = 10 << 20
)

// GetPlayerProgressRaw returns the raw player progress payload for one benchmark difficulty.
func (s *Service) GetPlayerProgressRaw(benchmarkID int) (string, error) {
	steamID := steam.GetSteamID(s.settingsSvc.Get())
	if steamID == "" {
		return "", errors.New("steam ID not found")
	}
	url := fmt.Sprintf(constants.KovaaksPlayerProgressURL, benchmarkID, steamID)

	return s.fetchPlayerProgress(url)
}

func (s *Service) fetchPlayerProgress(url string) (string, error) {
	s.progressRequestMu.Lock()
	defer s.progressRequestMu.Unlock()

	for attempt := 0; ; attempt++ {
		s.waitForProgressRequest()

		resp, err := s.httpClient.Get(url)
		if err != nil {
			return "", fmt.Errorf("failed to fetch player progress: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, maxProgressErrorBodySize))
			resp.Body.Close()

			if attempt >= maxProgressRetries {
				return "", fmt.Errorf("progress endpoint returned status %d after %d retries: %s", resp.StatusCode, attempt, strings.TrimSpace(string(body)))
			}

			delay, hasRetryAfter := retryAfterDelay(resp, time.Now())
			if !hasRetryAfter {
				delay = progressRetryDelay(attempt)
			}
			if delay > maxProgressRetryWait {
				delay = maxProgressRetryWait
			}
			if delay < s.progressRequestDelay {
				delay = s.progressRequestDelay
			}
			time.Sleep(delay)
			continue
		}

		body, err := io.ReadAll(io.LimitReader(resp.Body, maxProgressBodySize+1))
		resp.Body.Close()
		if err != nil {
			return "", fmt.Errorf("failed to read progress response: %w", err)
		}
		if resp.StatusCode != http.StatusOK {
			if len(body) > maxProgressErrorBodySize {
				body = body[:maxProgressErrorBodySize]
			}
			return "", fmt.Errorf("progress endpoint returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
		}
		if len(body) > maxProgressBodySize {
			return "", fmt.Errorf("progress response exceeded %d bytes", maxProgressBodySize)
		}
		return string(body), nil
	}
}

func (s *Service) waitForProgressRequest() {
	if !s.lastProgressRequest.IsZero() {
		if wait := s.progressRequestDelay - time.Since(s.lastProgressRequest); wait > 0 {
			time.Sleep(wait)
		}
	}
	s.lastProgressRequest = time.Now()
}

func retryAfterDelay(resp *http.Response, now time.Time) (time.Duration, bool) {
	raw := strings.TrimSpace(resp.Header.Get("Retry-After"))
	if raw == "" {
		return 0, false
	}
	if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second, true
	}
	if retryAt, err := http.ParseTime(raw); err == nil {
		if delay := retryAt.Sub(now); delay > 0 {
			return delay, true
		}
		return 0, true
	}
	return 0, false
}

func progressRetryDelay(attempt int) time.Duration {
	delay := initialProgressRetryWait
	for i := 0; i < attempt && delay < maxProgressRetryWait; i++ {
		delay *= 2
		if delay >= maxProgressRetryWait {
			return maxProgressRetryWait
		}
	}
	return delay
}

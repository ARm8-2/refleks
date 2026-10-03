package benchmarks

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestFetchPlayerProgressResponseBoundaries(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		const body = `{"overall_rank":2}`
		s := newBenchService(t, func(w http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(w, body)
		})
		got, err := s.fetchPlayerProgress(s.benchmarksURL)
		if err != nil || got != body {
			t.Fatalf("fetchPlayerProgress = %q, %v; want %q", got, err, body)
		}
	})

	t.Run("oversized success response", func(t *testing.T) {
		s := newBenchService(t, func(w http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(w, strings.Repeat("x", maxProgressBodySize+1))
		})
		_, err := s.fetchPlayerProgress(s.benchmarksURL)
		if err == nil || !strings.Contains(err.Error(), "progress response exceeded") {
			t.Fatalf("fetchPlayerProgress error = %v, want size limit error", err)
		}
	})

	t.Run("error response is truncated", func(t *testing.T) {
		s := newBenchService(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = io.WriteString(w, strings.Repeat("x", maxProgressErrorBodySize)+"private tail")
		})
		_, err := s.fetchPlayerProgress(s.benchmarksURL)
		if err == nil || !strings.Contains(err.Error(), "status 502") {
			t.Fatalf("fetchPlayerProgress error = %v, want 502", err)
		}
		if strings.Contains(err.Error(), "private tail") || strings.Count(err.Error(), "x") != maxProgressErrorBodySize {
			t.Errorf("error body was not limited to %d bytes: %v", maxProgressErrorBodySize, err)
		}
	})
}

func TestRetryAfterDelay(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name   string
		header string
		want   time.Duration
		valid  bool
	}{
		{"missing", "", 0, false},
		{"seconds", " 42 ", 42 * time.Second, true},
		{"zero", "0", 0, true},
		{"negative", "-1", 0, false},
		{"date", now.Add(15 * time.Second).Format(http.TimeFormat), 15 * time.Second, true},
		{"past date", now.Add(-time.Second).Format(http.TimeFormat), 0, true},
		{"invalid", "later", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{Header: http.Header{"Retry-After": []string{tt.header}}}
			got, valid := retryAfterDelay(resp, now)
			if got != tt.want || valid != tt.valid {
				t.Fatalf("retryAfterDelay(%q) = (%v, %v), want (%v, %v)", tt.header, got, valid, tt.want, tt.valid)
			}
		})
	}
}

func TestProgressRetryDelayCapsExponentialBackoff(t *testing.T) {
	for _, tt := range []struct {
		attempt int
		want    time.Duration
	}{
		{0, 30 * time.Second},
		{1, time.Minute},
		{2, 2 * time.Minute},
		{3, 4 * time.Minute},
		{4, 5 * time.Minute},
		{20, 5 * time.Minute},
	} {
		if got := progressRetryDelay(tt.attempt); got != tt.want {
			t.Errorf("progressRetryDelay(%d) = %v, want %v", tt.attempt, got, tt.want)
		}
	}
}

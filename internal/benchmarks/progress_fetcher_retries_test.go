package benchmarks

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type progressTrackedBody struct {
	io.Reader
	closed bool
}

func (b *progressTrackedBody) Close() error {
	b.closed = true
	return nil
}

type progressFailingReader struct{ err error }

func (r progressFailingReader) Read([]byte) (int, error) { return 0, r.err }

func TestFetchPlayerProgressRateLimitRetries(t *testing.T) {
	for _, recover := range []bool{true, false} {
		name := "retry budget exhausted"
		if recover {
			name = "success after rate limit"
		}
		t.Run(name, func(t *testing.T) {
			requests := 0
			var bodies []*progressTrackedBody
			s := &Service{httpClient: &http.Client{Transport: progressRoundTripFunc(func(*http.Request) (*http.Response, error) {
				requests++
				status, payload := http.StatusTooManyRequests, "rate limited"
				if recover && requests == 2 {
					status, payload = http.StatusOK, "progress"
				}
				body := &progressTrackedBody{Reader: strings.NewReader(payload)}
				bodies = append(bodies, body)
				return &http.Response{
					StatusCode: status,
					Header:     http.Header{"Retry-After": []string{"0"}},
					Body:       body,
				}, nil
			})}}
			got, err := s.fetchPlayerProgress("https://example.test/progress")
			if recover {
				if err != nil || got != "progress" || requests != 2 {
					t.Errorf("got %q, %v, %d requests; want progress after two requests", got, err, requests)
				}
			} else {
				if err == nil || !strings.Contains(err.Error(), "status 429 after 5 retries: rate limited") {
					t.Errorf("error = %v, want exhausted retry budget", err)
				}
				if requests != maxProgressRetries+1 {
					t.Errorf("requests = %d, want %d", requests, maxProgressRetries+1)
				}
			}
			for i, body := range bodies {
				if !body.closed {
					t.Errorf("response body %d was not closed", i)
				}
			}
		})
	}
}

func TestFetchPlayerProgressReadFailureClosesBody(t *testing.T) {
	readErr := errors.New("response interrupted")
	body := &progressTrackedBody{Reader: progressFailingReader{err: readErr}}
	s := &Service{httpClient: &http.Client{Transport: progressRoundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: body}, nil
	})}}
	_, err := s.fetchPlayerProgress("https://example.test/progress")
	if !errors.Is(err, readErr) {
		t.Errorf("error = %v, want wrapped read error", err)
	}
	if !body.closed {
		t.Error("response body was not closed after read failure")
	}
}

func TestFetchPlayerProgressTransportFailureIsNotRetried(t *testing.T) {
	transportErr := errors.New("connection failed")
	requests := 0
	s := &Service{httpClient: &http.Client{Transport: progressRoundTripFunc(func(*http.Request) (*http.Response, error) {
		requests++
		return nil, transportErr
	})}}
	_, err := s.fetchPlayerProgress("https://example.test/progress")
	if !errors.Is(err, transportErr) || requests != 1 {
		t.Errorf("error = %v, requests = %d; want wrapped transport error and one request", err, requests)
	}
}

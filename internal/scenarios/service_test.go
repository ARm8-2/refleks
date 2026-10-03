package scenarios

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"refleks/internal/constants"
	"refleks/internal/models"
	"refleks/internal/settings"
)

type scenarioRoundTripFunc func(*http.Request) (*http.Response, error)

func (f scenarioRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type scenarioResponseBody struct {
	io.Reader
	closeCount int
}

func (b *scenarioResponseBody) Close() error {
	b.closeCount++
	return nil
}

func newScenarioTestService(t *testing.T, persona string) *Service {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv(constants.EnvSteamInstallDirVar, t.TempDir())
	t.Setenv(constants.EnvKovaaksInstallDirVar, t.TempDir())
	t.Setenv(constants.EnvSteamIDVar, "test-steam-id")
	t.Setenv(constants.EnvPersonaNameVar, persona)
	// Empty identity overrides can trigger dotenv loading from the working directory.
	t.Chdir(home)
	return NewService(settings.NewService())
}

func TestNewService(t *testing.T) {
	s := newScenarioTestService(t, "test-player")
	if s.httpClient == nil {
		t.Fatal("NewService returned a nil HTTP client")
	}
	if got := s.httpClient.Timeout; got != 10*time.Second {
		t.Errorf("HTTP client timeout = %v, want 10s", got)
	}
	other := NewService(s.settingsSvc)
	if other.httpClient == s.httpClient {
		t.Error("service instances share an HTTP client")
	}
}

func TestGetLastScoresDecodesScoresAndEscapesQuery(t *testing.T) {
	const persona = "Player & + 雪"
	const scenario = "Aim & + café 世界"
	s := newScenarioTestService(t, persona)
	body := &scenarioResponseBody{Reader: strings.NewReader(`[
		{
			"id": "score-1",
			"type": "scenario-score",
			"attributes": {
				"fov": 103.5,
				"hash": "hash-1",
				"cm360": 35.25,
				"kills": 42,
				"score": 1234.5,
				"avgFps": 240.5,
				"avgTtk": 0.75,
				"fovScale": "Quake",
				"vertSens": 1.25,
				"horizSens": 1.5,
				"resolution": "1920x1080",
				"sensScale": "Source",
				"pauseCount": 2,
				"pauseDuration": 3,
				"accuracyDamage": 95,
				"challengeStart": "2026-09-30T12:00:00Z",
				"scenarioVersion": "v2",
				"clientBuildVersion": "build-3",
				"epoch": "1790769600"
			}
		},
		{
			"id": "score-2",
			"type": "scenario-score",
			"attributes": {"score": 987.25, "kills": 21}
		}
	]`)}
	requests := 0
	s.httpClient.Transport = scenarioRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		requests++
		if req.Method != http.MethodGet {
			t.Errorf("request method = %q, want GET", req.Method)
		}
		wantURL := fmt.Sprintf(constants.KovaaksLastScoresURL,
			"Player+%26+%2B+%E9%9B%AA", "Aim+%26+%2B+caf%C3%A9+%E4%B8%96%E7%95%8C")
		if got := req.URL.String(); got != wantURL {
			t.Errorf("request URL = %q, want %q", got, wantURL)
		}
		wantQuery := url.Values{"username": {persona}, "scenarioName": {scenario}}
		if got := req.URL.Query(); !reflect.DeepEqual(got, wantQuery) {
			t.Errorf("decoded query = %#v, want %#v", got, wantQuery)
		}
		return &http.Response{StatusCode: http.StatusOK, Body: body}, nil
	})

	got, err := s.GetLastScores(scenario)
	if err != nil {
		t.Fatalf("GetLastScores: %v", err)
	}
	want := []models.KovaaksLastScore{
		{
			ID:   "score-1",
			Type: "scenario-score",
			Attributes: models.KovaaksScoreAttributes{
				Fov:                103.5,
				Hash:               "hash-1",
				Cm360:              35.25,
				Kills:              42,
				Score:              1234.5,
				AvgFps:             240.5,
				AvgTtk:             0.75,
				FovScale:           "Quake",
				VertSens:           1.25,
				HorizSens:          1.5,
				Resolution:         "1920x1080",
				SensScale:          "Source",
				PauseCount:         2,
				PauseDuration:      3,
				AccuracyDamage:     95,
				ChallengeStart:     "2026-09-30T12:00:00Z",
				ScenarioVersion:    "v2",
				ClientBuildVersion: "build-3",
				Epoch:              "1790769600",
			},
		},
		{
			ID:         "score-2",
			Type:       "scenario-score",
			Attributes: models.KovaaksScoreAttributes{Score: 987.25, Kills: 21},
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("scores = %#v, want %#v", got, want)
	}
	if requests != 1 {
		t.Errorf("request count = %d, want 1", requests)
	}
	if body.closeCount != 1 {
		t.Errorf("body close count = %d, want 1", body.closeCount)
	}
}

func TestGetLastScoresEmpty(t *testing.T) {
	s := newScenarioTestService(t, "test-player")
	body := &scenarioResponseBody{Reader: strings.NewReader(`[]`)}
	s.httpClient.Transport = scenarioRoundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: body}, nil
	})

	got, err := s.GetLastScores("test-scenario")
	if err != nil {
		t.Fatalf("GetLastScores: %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Errorf("scores = %#v, want a non-nil empty slice", got)
	}
	if body.closeCount != 1 {
		t.Errorf("body close count = %d, want 1", body.closeCount)
	}
}

func TestGetLastScoresResponseErrors(t *testing.T) {
	for _, tt := range []struct {
		name   string
		status int
		body   string
	}{
		{name: "not found", status: http.StatusNotFound, body: "not JSON"},
		{name: "unavailable", status: http.StatusServiceUnavailable, body: `[]`},
		{name: "malformed JSON", status: http.StatusOK, body: `[{"id": !}]`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s := newScenarioTestService(t, "test-player")
			body := &scenarioResponseBody{Reader: strings.NewReader(tt.body)}
			s.httpClient.Transport = scenarioRoundTripFunc(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: tt.status, Body: body}, nil
			})

			got, err := s.GetLastScores("test-scenario")
			if err == nil {
				t.Fatal("GetLastScores succeeded, want an error")
			}
			if got != nil {
				t.Errorf("scores = %#v, want nil on error", got)
			}
			if tt.status != http.StatusOK {
				want := fmt.Sprintf("API request failed with status: %d", tt.status)
				if err.Error() != want {
					t.Errorf("error = %q, want %q", err, want)
				}
			} else {
				var syntaxErr *json.SyntaxError
				if !errors.As(err, &syntaxErr) {
					t.Errorf("error = %v, want a JSON syntax error", err)
				}
			}
			if body.closeCount != 1 {
				t.Errorf("body close count = %d, want 1", body.closeCount)
			}
		})
	}
}

func TestGetLastScoresTransportError(t *testing.T) {
	s := newScenarioTestService(t, "test-player")
	transportErr := errors.New("transport failed")
	requests := 0
	s.httpClient.Transport = scenarioRoundTripFunc(func(*http.Request) (*http.Response, error) {
		requests++
		return nil, transportErr
	})

	got, err := s.GetLastScores("test-scenario")
	if !errors.Is(err, transportErr) {
		t.Errorf("error = %v, want wrapped transport error %v", err, transportErr)
	}
	if got != nil {
		t.Errorf("scores = %#v, want nil on error", got)
	}
	if requests != 1 {
		t.Errorf("request count = %d, want 1", requests)
	}
}

func TestGetLastScoresMissingPersonaDoesNotRequest(t *testing.T) {
	s := newScenarioTestService(t, "")
	steamDir := s.settingsSvc.Get().SteamInstallDir
	entries, err := os.ReadDir(steamDir)
	if err != nil {
		t.Fatalf("read isolated Steam directory: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("isolated Steam directory is not empty: %v", entries)
	}
	requests := 0
	s.httpClient.Transport = scenarioRoundTripFunc(func(*http.Request) (*http.Response, error) {
		requests++
		return nil, errors.New("unexpected HTTP request")
	})

	got, err := s.GetLastScores("test-scenario")
	if err == nil || err.Error() != "could not determine Steam PersonaName" {
		t.Errorf("error = %v, want missing Steam PersonaName error", err)
	}
	if got != nil {
		t.Errorf("scores = %#v, want nil on error", got)
	}
	if requests != 0 {
		t.Errorf("request count = %d, want 0", requests)
	}
}

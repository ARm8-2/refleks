package runs

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func TestAnonymizeRunEnvironment(t *testing.T) {
	env := models.RunEnvironment{
		AppVersion: "1.0", OS: "windows", SteamID: "76561198000000000",
		PersonaName: "player", CPUName: "cpu",
	}
	got := anonymizeRunEnvironment(env)
	if got.SteamID != "" || got.PersonaName != "" {
		t.Fatalf("identifying fields not cleared: %+v", got)
	}
	if got.AppVersion != "1.0" || got.OS != "windows" || got.CPUName != "cpu" {
		t.Fatalf("non-identifying fields changed: %+v", got)
	}
}

func TestBuildSyncPayloadRaw(t *testing.T) {
	path := writeTempRun(t, sampleRecord())
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	reader, closeBody, length, err := buildSyncPayload(path, false)
	if err != nil {
		t.Fatalf("buildSyncPayload: %v", err)
	}
	defer closeBody()

	if length != int64(len(data)) {
		t.Errorf("content length = %d, want %d", length, len(data))
	}
	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, data) {
		t.Error("raw payload does not match the source file")
	}
}

func TestBuildSyncPayloadAnonymous(t *testing.T) {
	rec := sampleRecord()
	rec.Env.SteamID = "secret-id"
	rec.Env.PersonaName = "secret-name"
	path := writeTempRun(t, rec)

	reader, closeBody, length, err := buildSyncPayload(path, true)
	if err != nil {
		t.Fatalf("buildSyncPayload: %v", err)
	}
	defer closeBody()

	payload, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if length != int64(len(payload)) {
		t.Errorf("content length = %d, want %d", length, len(payload))
	}

	anonPath := filepath.Join(t.TempDir(), "anon.refleks")
	if err := os.WriteFile(anonPath, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := readRecordFile(anonPath, readRecordOptions{})
	if err != nil {
		t.Fatalf("readRecordFile(anon): %v", err)
	}
	if got.Env.SteamID != "" || got.Env.PersonaName != "" {
		t.Fatalf("identity not scrubbed: %+v", got.Env)
	}
	if got.Env.CPUName != rec.Env.CPUName || got.Env.AppVersion != rec.Env.AppVersion {
		t.Error("unrelated environment fields should be preserved")
	}
	if got.Stats.Summary.Score != rec.Stats.Summary.Score {
		t.Error("stats should be preserved in an anonymized payload")
	}
}

func TestBuildSyncPayloadMissingFile(t *testing.T) {
	if _, _, _, err := buildSyncPayload(filepath.Join(t.TempDir(), "missing.refleks"), false); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestSyncRunFile(t *testing.T) {
	path := writeTempRun(t, sampleRecord())
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	var gotName, gotVersion, gotType string
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		gotName = r.Header.Get("X-Refleks-File-Name")
		gotVersion = r.Header.Get("X-Refleks-App-Version")
		gotType = r.Header.Get("Content-Type")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &CloudSyncClient{endpoint: srv.URL, client: srv.Client()}
	if err := c.SyncRunFile(context.Background(), path, false); err != nil {
		t.Fatalf("SyncRunFile: %v", err)
	}

	if gotName != filepath.Base(path) {
		t.Errorf("X-Refleks-File-Name = %q, want %q", gotName, filepath.Base(path))
	}
	if gotVersion != constants.AppVersion {
		t.Errorf("X-Refleks-App-Version = %q, want %q", gotVersion, constants.AppVersion)
	}
	if gotType != "application/octet-stream" {
		t.Errorf("Content-Type = %q", gotType)
	}
	if !bytes.Equal(gotBody, data) {
		t.Error("uploaded body does not match the run file")
	}
}

func TestSyncRunFileErrors(t *testing.T) {
	path := writeTempRun(t, sampleRecord())

	t.Run("non-2xx with body", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("sync exploded"))
		}))
		defer srv.Close()

		c := &CloudSyncClient{endpoint: srv.URL, client: srv.Client()}
		err := c.SyncRunFile(context.Background(), path, false)
		if err == nil || !strings.Contains(err.Error(), "500") || !strings.Contains(err.Error(), "sync exploded") {
			t.Fatalf("err = %v, want status and body detail", err)
		}
	})

	t.Run("non-2xx without body", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
		}))
		defer srv.Close()

		c := &CloudSyncClient{endpoint: srv.URL, client: srv.Client()}
		err := c.SyncRunFile(context.Background(), path, false)
		if err == nil || !strings.Contains(err.Error(), "502") {
			t.Fatalf("err = %v, want status detail", err)
		}
	})

	t.Run("missing endpoint", func(t *testing.T) {
		c := &CloudSyncClient{client: http.DefaultClient}
		if err := c.SyncRunFile(context.Background(), path, false); err == nil {
			t.Fatal("expected error for missing endpoint")
		}
	})

	t.Run("missing run path", func(t *testing.T) {
		c := &CloudSyncClient{endpoint: "http://example.test", client: http.DefaultClient}
		if err := c.SyncRunFile(context.Background(), "  ", false); err == nil {
			t.Fatal("expected error for missing run path")
		}
	})

	t.Run("nil client", func(t *testing.T) {
		var c *CloudSyncClient
		if err := c.SyncRunFile(context.Background(), path, false); err == nil {
			t.Fatal("expected error for nil client")
		}
	})
}

func TestResolveRunsSyncEndpoint(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	t.Setenv(constants.EnvRunsSyncURLVar, "  http://example.test/sync  ")
	if got := resolveRunsSyncEndpoint(); got != "http://example.test/sync" {
		t.Fatalf("endpoint = %q, want env override", got)
	}

	t.Setenv(constants.EnvRunsSyncURLVar, "")
	if got := resolveRunsSyncEndpoint(); got != constants.RefleksRunsSyncURL {
		t.Fatalf("endpoint = %q, want default", got)
	}
}

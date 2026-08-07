package runs

import (
	"os"
	"testing"

	"refleks/internal/models"
)

func TestReplayStatusUsesStructuredMessageForStoredState(t *testing.T) {
	t.Setenv("USERPROFILE", t.TempDir())
	store := NewStore(nil)
	store.setReplayStatus("example.refleks", models.ReplayStateProcessing, "replay.processing")

	status := store.GetReplayStatus("example.refleks")
	if status.MessageCode != "replay.processing" {
		t.Fatalf("MessageCode = %q", status.MessageCode)
	}
}

func TestReplayStatusUsesSameReadyContractForPublishedFile(t *testing.T) {
	t.Setenv("USERPROFILE", t.TempDir())
	store := NewStore(nil)
	path, err := store.ReplayPath("example.refleks", ".mp4")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("video"), 0o600); err != nil {
		t.Fatal(err)
	}

	status := store.GetReplayStatus("example.refleks")
	if status.State != models.ReplayStateReady || status.MessageCode != "replay.ready" {
		t.Fatalf("status = %#v", status)
	}
}

func TestReplayStatusUsesStructuredFallback(t *testing.T) {
	t.Setenv("USERPROFILE", t.TempDir())
	status := NewStore(nil).GetReplayStatus("missing.refleks")
	if status.MessageCode != "replay.notRecorded" {
		t.Fatalf("MessageCode = %q", status.MessageCode)
	}
}

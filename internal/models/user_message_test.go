package models

import "testing"

func TestNewUserMessage(t *testing.T) {
	message := NewUserMessage("replay.failed", MessageParams{"attempt": 2, "retryable": true})
	if message.MessageCode != "replay.failed" {
		t.Fatalf("MessageCode = %q", message.MessageCode)
	}
}

func TestNewUserMessageRejectsInvalidCode(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected invalid code to panic")
		}
	}()
	NewUserMessage("Replay failed", nil)
}

func TestNewUserMessageRejectsStructuredParams(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected structured params to panic")
		}
	}()
	NewUserMessage("replay.failed", MessageParams{"details": map[string]string{"raw": "error"}})
}

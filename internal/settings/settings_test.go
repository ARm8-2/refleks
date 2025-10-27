package settings

import (
	"testing"

	"refleks/internal/constants"
	"refleks/internal/models"
)

func TestSanitizeAppliesDefaults(t *testing.T) {
	s := models.Settings{}
	s2 := Sanitize(s)
	if s2.SessionGapMinutes != constants.DefaultSessionGapMinutes {
		t.Fatalf("expected SessionGapMinutes default %d, got %d", constants.DefaultSessionGapMinutes, s2.SessionGapMinutes)
	}
	if s2.Theme != constants.DefaultTheme {
		t.Fatalf("expected Theme default %q, got %q", constants.DefaultTheme, s2.Theme)
	}
	if s2.MouseBufferMinutes != constants.DefaultMouseBufferMinutes {
		t.Fatalf("expected MouseBufferMinutes default %d, got %d", constants.DefaultMouseBufferMinutes, s2.MouseBufferMinutes)
	}
	if s2.MaxExistingOnStart != constants.DefaultMaxExistingOnStart {
		t.Fatalf("expected MaxExistingOnStart default %d, got %d", constants.DefaultMaxExistingOnStart, s2.MaxExistingOnStart)
	}
	if s2.TracesDir == "" {
		t.Fatalf("expected non-empty TracesDir default")
	}
}

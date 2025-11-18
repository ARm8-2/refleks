package ai

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"

	"refleks/internal/models"
)

// NOTE: AI option types are defined in `internal/models` and exposed to the
// frontend. The internal ai package uses the model type directly to avoid
// duplicated/parallel definitions.

// SessionInsightsInput is the full payload sent to the LLM client.
type SessionInsightsInput struct {
	SessionID string                  `json:"sessionId"`
	Records   []models.ScenarioRecord `json:"records"`
	Options   models.AIOptions        `json:"options"`
	Prompt    string                  `json:"prompt"`
}

// Delta is a partial text chunk streamed from the model.
type Delta struct {
	RequestID string `json:"requestId"`
	Text      string `json:"text"`
}

// Done indicates stream completion and optional usage metadata.
type Done struct {
	RequestID string `json:"requestId"`
	Cached    bool   `json:"cached"`
}

// FingerprintSession makes a short hash for caching based on records and options length caps.
func FingerprintSession(in SessionInsightsInput) string {
	// Construct a compact string: sessionId + number of records + last filenames
	// This is best-effort; backend may include prompt in the cache key separately.
	s := in.SessionID + ":" + strconv.Itoa(len(in.Records))
	// include up to 5 last filenames for stability
	for i := 0; i < len(in.Records) && i < 5; i++ {
		s += ":" + in.Records[i].FileName
	}
	// include options that affect prompt content to make cache safer (maxRuns, persona)
	if in.Options.MaxRunsPerScenario != 0 || strings.TrimSpace(in.Options.SystemPersona) != "" {
		s += ":opts=" + strconv.Itoa(in.Options.MaxRunsPerScenario) + ":" + in.Options.SystemPersona
	}
	// include a hash of the user prompt if present
	if strings.TrimSpace(in.Prompt) != "" {
		ph := sha256.Sum256([]byte(in.Prompt))
		s += ":prompt=" + hex.EncodeToString(ph[:4])
	}
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:8])
}
